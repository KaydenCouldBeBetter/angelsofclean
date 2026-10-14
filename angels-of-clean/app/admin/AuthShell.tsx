// Shared frame for the signed-out admin screens: sign in, forgot password,
// and choosing a new password.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
      <div className="h-1 bg-[#1a6b5a]" />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[400px] bg-white rounded-xl shadow-sm p-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a6b5a] flex items-center justify-center">
              <span className="text-white text-2xl font-bold">A</span>
            </div>
            <h1 className="mt-4 text-xl font-bold text-zinc-900">Angels of Clean</h1>
            <p className="text-sm text-zinc-500 mt-1">Admin Portal</p>
          </div>

          <div className="h-px bg-zinc-200 my-6" />

          {children}
        </div>
      </div>

      <p className="text-center text-xs text-zinc-400 pb-6">
        Angels of Clean · Admin Access Only
      </p>
    </div>
  );
}
