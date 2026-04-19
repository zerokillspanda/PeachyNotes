'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Course = {
  id: number
  name: string
}

type Props = {
  userId: string
  courses: Course[]
}

export default function CreateLectureButton({ userId, courses }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState(
    courses.length > 0 ? String(courses[0].id) : ''
  )

  const handleCreateLecture = async () => {
    if (!selectedCourseId) {
      setMessage('Please choose a course.')
      return
    }

    setLoading(true)
    setMessage('')

    const supabase = createClient()

    const selectedCourse = courses.find(
      (course) => String(course.id) === selectedCourseId
    )

    const { error } = await supabase.from('lectures').insert({
      user_id: userId,
      course_id: Number(selectedCourseId),
      title: `${selectedCourse?.name ?? 'Lecture'} - ${new Date().toLocaleString()}`,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage('Lecture created successfully.')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <select
        value={selectedCourseId}
        onChange={(e) => setSelectedCourseId(e.target.value)}
        className="border rounded px-3 py-2"
      >
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleCreateLecture}
        disabled={loading || courses.length === 0}
        className="rounded bg-blue-600 text-white px-4 py-2"
      >
        {loading ? 'Creating...' : 'Create Lecture'}
      </button>

      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}