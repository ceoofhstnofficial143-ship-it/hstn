'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Home, Briefcase, MapPin, Check, Trash2, Edit2, Loader2, Star, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AddressForm from './AddressForm';

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
  country: string;
  label: string;
  is_default: boolean;
}

export default function AddressList() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const fetchAddresses = async () => {
    setIsLoading(true);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`/api/addresses/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      if (!resp.ok) throw new Error('Failed to delete address');
      setAddresses(prev => prev.filter(a => a.id !== id));
      // Refresh list if deleted address was default
      const deleted = addresses.find(a => a.id === id);
      if (deleted?.is_default) fetchAddresses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`/api/addresses/${id}/set-default`, { 
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      if (!resp.ok) throw new Error('Failed to set default address');
      
      setAddresses(prev => prev.map(a => ({
        ...a,
        is_default: a.id === id
      })));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingAddress(null);
    fetchAddresses();
  };

  const getLabelIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home': return <Home className="w-4 h-4" />;
      case 'work': return <Briefcase className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  if (isLoading && addresses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium">Loading your addresses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Saved Addresses</h2>
        {!showForm && !editingAddress && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all text-sm shadow-xl shadow-slate-200"
          >
            <Plus className="w-4 h-4" />
            Add New
          </button>
        )}
      </div>

      {(showForm || editingAddress) && (
        <AddressForm
          initialData={editingAddress}
          onSuccess={handleFormSuccess}
          onCancel={() => { setShowForm(false); setEditingAddress(null); }}
        />
      )}

      {error && !showForm && !editingAddress && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center justify-between">
          <p className="font-medium">{error}</p>
          <button onClick={fetchAddresses} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {addresses.map(address => (
          <div
            key={address.id}
            className={`group relative p-5 bg-white rounded-2xl border-2 transition-all ${
              address.is_default
                ? 'border-blue-600 shadow-xl shadow-blue-50'
                : 'border-slate-100 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                  address.is_default ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {getLabelIcon(address.label)}
                  {address.label}
                </span>
                {address.is_default && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-blue-600" />
                    Default
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingAddress(address)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(address.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-slate-900">{address.full_name}</h4>
              <p className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <Phone className="w-3 h-3" />
                {address.phone_number}
              </p>
              <div className="pt-2 text-sm text-slate-500 leading-relaxed max-w-[80%] font-medium">
                {address.address_line1}, {address.address_line2 && `${address.address_line2}, `}
                {address.landmark && <span className="block text-slate-400 text-xs italic">Near: {address.landmark}</span>}
                {address.city}, {address.state} - <span className="text-slate-900 font-bold">{address.pincode}</span>
              </div>
            </div>

            {!address.is_default && (
              <button
                onClick={() => handleSetDefault(address.id)}
                className="mt-4 w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-slate-200 border-dashed hover:border-blue-200"
              >
                Set as default
              </button>
            )}
          </div>
        ))}

        {!showForm && !editingAddress && addresses.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
              <MapPin className="w-8 h-8 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-black text-lg">No addresses yet</p>
              <p className="text-slate-400 text-sm font-medium">Add an address for faster checkout</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 px-6 py-2.5 bg-blue-600 text-white font-black rounded-full shadow-lg shadow-blue-100 hover:scale-105 transition-transform"
            >
              Add New Address
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
