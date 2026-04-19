import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type NotesResult = {
  lecture_summary?: string;
  key_topics?: string[] | string;
  authorities_mentioned?: string[] | string;
  supplement_bubble?: string[] | string;
  used_sources?: string[] | string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function truncateText(text: string, maxLength = 1900) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function paragraphBlock(text: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: truncateText(text || ""),
          },
        },
      ],
    },
  };
}

function heading2Block(text: string) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [
        {
          type: "text",
          text: {
            content: truncateText(text, 200),
          },
        },
      ],
    },
  };
}

function bulletedListItemBlock(text: string) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          text: {
            content: truncateText(text || ""),
          },
        },
      ],
    },
  };
}

function calloutBlock(items: string[]) {
  const content =
    items.length > 0
      ? items.join("\n• ")
      : "No clearly relevant supplementary points were identified from the course notes.";

  const finalText = items.length > 0 ? `• ${content}` : content;

  return {
    object: "block",
    type: "callout",
    callout: {
      icon: {
        emoji: "📚",
      },
      rich_text: [
        {
          type: "text",
          text: {
            content: truncateText(finalText),
          },
        },
      ],
    },
  };
}

function buildNotionChildren(result: NotesResult) {
  const keyTopics = toStringArray(result.key_topics);
  const authorities = toStringArray(result.authorities_mentioned);
  const supplement = toStringArray(result.supplement_bubble);
  const usedSources = toStringArray(result.used_sources);

  const blocks: any[] = [];

  blocks.push(heading2Block("Lecture Summary"));
  blocks.push(paragraphBlock(result.lecture_summary?.trim() || "No summary available."));

  blocks.push(heading2Block("Key Topics"));
  if (keyTopics.length > 0) {
    for (const item of keyTopics) {
      blocks.push(bulletedListItemBlock(item));
    }
  } else {
    blocks.push(paragraphBlock("No key topics identified."));
  }

  blocks.push(heading2Block("Authorities Mentioned"));
  if (authorities.length > 0) {
    for (const item of authorities) {
      blocks.push(bulletedListItemBlock(item));
    }
  } else {
    blocks.push(paragraphBlock("No authorities mentioned."));
  }

  blocks.push(heading2Block("From course notes: not clearly covered in class"));
  blocks.push(calloutBlock(supplement));

  blocks.push(heading2Block("Used Sources"));
  if (usedSources.length > 0) {
    for (const item of usedSources) {
      blocks.push(bulletedListItemBlock(item));
    }
  } else {
    blocks.push(paragraphBlock("No course-note sources listed."));
  }

  return blocks;
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Not authenticated.", 401);
    }

    const body = await request.json();

    const title =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim()
        : "Untitled Lecture Notes";

    const result = (body?.result ?? {}) as NotesResult;
    const lectureId =
      body?.lectureId !== undefined && body?.lectureId !== null
        ? Number(body.lectureId)
        : null;

    if (!result || typeof result !== "object") {
      return jsonError("Missing result payload.");
    }

    const { data: notionConnection, error: connectionError } = await supabase
      .from("notion_connections")
      .select("access_token, parent_page_id")
      .eq("user_id", user.id)
      .single();

    if (connectionError || !notionConnection) {
      return jsonError("Notion is not connected for this user.", 400);
    }

    if (!notionConnection.parent_page_id) {
      return jsonError("No parent Notion page selected yet.", 400);
    }

    const notionResponse = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionConnection.access_token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: {
          type: "page_id",
          page_id: notionConnection.parent_page_id,
        },
        properties: {
          title: {
            title: [
              {
                type: "text",
                text: {
                  content: truncateText(title, 200),
                },
              },
            ],
          },
        },
        children: buildNotionChildren(result),
      }),
    });

    const notionData = await readJsonSafely(notionResponse);

    if (!notionResponse.ok) {
      return jsonError(
        notionData?.message ||
          notionData?.error?.message ||
          "Notion export failed.",
        500
      );
    }

    const notionPageId =
      typeof notionData?.id === "string" ? notionData.id : null;

    const notionPageUrl =
      typeof notionData?.url === "string" ? notionData.url : null;

    if (lectureId && !Number.isNaN(lectureId) && notionPageId) {
      const { error: lectureUpdateError } = await supabase
        .from("lectures")
        .update({
          notion_page_id: notionPageId,
        })
        .eq("id", lectureId)
        .eq("user_id", user.id);

      if (lectureUpdateError) {
        return jsonError(
          `Notion page was created, but saving notion_page_id on the lecture failed: ${lectureUpdateError.message}`,
          500
        );
      }
    }

    return NextResponse.json({
      success: true,
      notionPageId,
      notionPageUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return jsonError(message, 500);
  }
}