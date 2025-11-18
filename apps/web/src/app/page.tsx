import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          ACK Thiboro SACCO Platform
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Welcome to the ACK Thiboro SACCO Management System
        </p>
        
        {/* Quick Actions */}
        <div className="flex justify-center gap-4 mb-12">
          <Link
            href="/auth/sign-in"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Sign In
          </Link>
          <Link
            href="/teller"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Teller (Deposits)
          </Link>
          <Link
            href="/health"
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            API Health Check
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Members</h3>
            <p className="text-gray-600">Manage SACCO members and their accounts</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Loans</h3>
            <p className="text-gray-600">Process and track loan applications</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Savings</h3>
            <p className="text-gray-600">Monitor savings and shares contributions</p>
          </div>
        </div>
      </div>
    </main>
  );
}
