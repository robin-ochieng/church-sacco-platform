import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AT</span>
              </div>
              <span className="text-gray-900 font-semibold">ACK Thiboro SACCO</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/loans/apply" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Loans
              </Link>
              <Link href="/member" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Portal
              </Link>
              <Link href="/register" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Register
              </Link>
              <Link
                href="/auth/sign-in"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-blue-600 font-medium text-sm mb-4 tracking-wide uppercase">
            Trusted Financial Partner
          </p>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
            Building Wealth,
            <span className="block text-blue-600">Together.</span>
          </h1>
          
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Secure savings, affordable loans, and transparent financial services 
            for the ACK Thiboro community.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-20">
            <Link
              href="/register"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Become a Member
            </Link>
            <Link
              href="/loans/apply/wizard"
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
            >
              Apply for Loan
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { value: 'KES 50M+', label: 'Total Savings' },
              { value: '500+', label: 'Members' },
              { value: '12%', label: 'Interest p.a.' },
              { value: '48hrs', label: 'Loan Approval' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Services Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Our Services</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Simple, transparent financial services designed for our community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Savings */}
            <Link href="/member" className="group">
              <div className="p-8 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all bg-white">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Savings</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Earn competitive dividends on your deposits. Start with as little as KES 500 monthly.
                </p>
              </div>
            </Link>

            {/* Loans */}
            <Link href="/loans/apply/wizard" className="group">
              <div className="p-8 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all bg-white">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loans</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Access affordable credit at 12% p.a. with flexible repayment up to 60 months.
                </p>
              </div>
            </Link>

            {/* Shares */}
            <Link href="/member" className="group">
              <div className="p-8 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all bg-white">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Shares</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Invest in SACCO shares and earn annual dividends. Build ownership over time.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Get Started in 3 Steps</h2>
            <p className="text-gray-500">Join our community and start your financial journey.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '1',
                title: 'Register',
                description: 'Fill out a simple online form with your details and upload your ID.',
              },
              {
                step: '2',
                title: 'Pay Fee',
                description: 'Complete membership with a one-time KES 2,000 registration fee.',
              },
              {
                step: '3',
                title: 'Start Saving',
                description: 'Make deposits, buy shares, and access loans through your portal.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-semibold">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 px-4 border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/teller"
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className="text-gray-900 font-medium text-sm">Teller Services</div>
                <div className="text-gray-400 text-xs">Deposits & Withdrawals</div>
              </div>
            </Link>

            <Link
              href="/members"
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-gray-900 font-medium text-sm">Members</div>
                <div className="text-gray-400 text-xs">View Directory</div>
              </div>
            </Link>

            <Link
              href="/verify"
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="text-gray-900 font-medium text-sm">Verification</div>
                <div className="text-gray-400 text-xs">KYC Status</div>
              </div>
            </Link>

            <Link
              href="/health"
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-gray-900 font-medium text-sm">System Status</div>
                <div className="text-gray-400 text-xs">API Health</div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">AT</span>
              </div>
              <span className="text-gray-400 text-sm">© 2025 ACK Thiboro SACCO</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/register" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
                Register
              </Link>
              <Link href="/loans/apply" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
                Loans
              </Link>
              <Link href="/auth/sign-in" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
