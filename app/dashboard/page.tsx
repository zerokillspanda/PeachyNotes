import CreateLectureButton from "./create-lecture-button";

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-12">
      
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">Workspace</h1>
        <p className="text-slate-400">Welcome back, Utkarsh. Ready to conquer your Cyber Law readings?</p>
      </header>

      <section className="flex flex-col items-center justify-center p-16 bg-slate-800/30 border border-slate-700 rounded-2xl border-dashed">
        <h2 className="text-xl font-medium text-slate-300 mb-8">Record a new class or lecture</h2>
        <CreateLectureButton />
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-300 mb-4">Recent Notes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="p-5 bg-slate-800 rounded-xl border border-slate-700 hover:border-[#FF8C69] transition cursor-pointer">
            <p className="text-xs font-bold text-[#FF8C69] uppercase tracking-wider mb-2">Case Brief</p>
            <h4 className="font-medium text-white mb-1">Information Technology Act Amendments</h4>
            <p className="text-sm text-slate-400">Generated 2 hours ago</p>
          </div>

          <div className="p-5 bg-slate-800 rounded-xl border border-slate-700 hover:border-[#FF8C69] transition cursor-pointer">
            <p className="text-xs font-bold text-[#FF8C69] uppercase tracking-wider mb-2">Lecture Notes</p>
            <h4 className="font-medium text-white mb-1">AI & Intellectual Property Rights</h4>
            <p className="text-sm text-slate-400">Generated yesterday</p>
          </div>

        </div>
      </section>

    </div>
  );
}
