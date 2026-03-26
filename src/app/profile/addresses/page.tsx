import React from 'react';
import AddressList from '@/components/profile/AddressList';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'My Addresses | HSTNLX',
  description: 'Manage your saved addresses for checkout and deliveries.',
}

export default function AddressesPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 pt-10 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        
        {/* Navigation / Header */}
        <div className="flex items-center gap-6">
          <Link 
            href="/profile" 
            className="group w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm hover:scale-110 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-slate-900 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Addresses</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Your delivery dashboard</p>
          </div>
        </div>

        {/* Info Card */}
        <div className="relative overflow-hidden bg-blue-600 rounded-[32px] p-8 shadow-2xl shadow-blue-100">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-white text-2xl font-black tracking-tight">Need help with shipping?</h2>
              <p className="text-blue-100 font-medium max-w-sm leading-relaxed">
                Add multiple addresses for home and work to speed up your checkout process at HSTNLX.
              </p>
            </div>
            <div className="flex -space-x-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-14 h-14 bg-blue-500/50 backdrop-blur-md rounded-2xl border-2 border-blue-400 rotate-12 flex items-center justify-center">
                  <span className="text-white text-xl font-black">?</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        </div>

        {/* Address List Section */}
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[40px] p-8 shadow-xl shadow-slate-100/50">
          <AddressList />
        </div>

        {/* Footer info */}
        <div className="text-center p-6 bg-slate-100/50 rounded-3xl border border-slate-200 border-dashed">
          <p className="text-slate-400 text-sm font-medium">
            Your data is secured by HSTNLX Enterprise Protection Layers. <br />
            We never share your personal information.
          </p>
        </div>

      </div>
    </div>
  );
}
