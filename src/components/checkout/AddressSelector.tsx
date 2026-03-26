'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Check, Home, Briefcase, Loader2, ChevronRight, User, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Address {
  id: string;
  full_name: string;
  phone_number: string;
  address_line1: string;
  address_line2: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  label: string;
  is_default: boolean;
}

interface AddressSelectorProps {
  selectedId: string | null;
  onSelect: (address: Address) => void;
}

export default function AddressSelector({ selectedId, onSelect }: AddressSelectorProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch('/api/addresses', {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`
          }
        });
        if (!resp.ok) throw new Error('Failed to fetch addresses');
        const data = await resp.json();
        setAddresses(data);
        
        // Auto-select default if none selected
        if (!selectedId && data.length > 0) {
          const def = data.find((a: Address) => a.is_default) || data[0];
          onSelect(def);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAddresses();
  }, [selectedId, onSelect]);

  if (isLoading) return (
    <div className="flex items-center gap-3 p-6 bg-accent/5 rounded-2xl animate-pulse">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Retrieving secure destinations...</span>
    </div>
  );

  if (addresses.length === 0) return (
    <div className="p-8 bg-accent/5 rounded-[32px] border-2 border-dashed border-white/10 text-center space-y-4">
      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
        <MapPin className="w-6 h-6 text-white/20" />
      </div>
      <div>
        <p className="text-white font-bold uppercase tracking-widest text-[10px]">No destinations found</p>
        <p className="text-white/40 text-[9px] mt-1 font-medium">Acquisition requires a verified shipping protocol.</p>
      </div>
      <Link 
        href="/profile/addresses" 
        className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform"
      >
        <Plus className="w-3 h-3" />
        Add Address
      </Link>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-caption font-bold uppercase tracking-widest text-white/50">Shipping Destination</h3>
        <Link href="/profile/addresses" className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline">
          Manage
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {addresses.map(address => (
          <button
            key={address.id}
            onClick={() => onSelect(address)}
            className={`group relative text-left p-5 rounded-2xl border-2 transition-all ${
              selectedId === address.id
                ? 'border-primary bg-primary/5 shadow-xl shadow-primary/5'
                : 'border-white/5 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    selectedId === address.id ? 'bg-primary text-white' : 'bg-white/10 text-white/40'
                  }`}>
                    {address.label}
                  </span>
                  {address.is_default && (
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-white">{address.full_name}</p>
                <div className="text-[10px] text-white/50 font-medium leading-relaxed">
                  {address.address_line1}, {address.city} - <span className="text-white/80 font-bold">{address.pincode}</span>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedId === address.id ? 'border-primary bg-primary' : 'border-white/10'
              }`}>
                {selectedId === address.id && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
