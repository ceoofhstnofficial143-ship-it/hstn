'use client';

import React, { useState } from 'react';
import { MapPin, Phone, User, Landmark, Globe, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AddressFormProps {
  initialData?: any;
  onSuccess: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function AddressForm({ initialData, onSuccess, onCancel, isLoading: externalLoading }: AddressFormProps) {
  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || '',
    phone_number: initialData?.phone_number || '',
    address_line1: initialData?.address_line1 || '',
    address_line2: initialData?.address_line2 || '',
    landmark: initialData?.landmark || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    label: initialData?.label || 'home',
    is_default: initialData?.is_default || false,
    country: initialData?.country || 'India',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const isUpdate = !!initialData?.id;
    const url = isUpdate ? `/api/addresses/${initialData.id}` : '/api/addresses';
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        let msg = data.error || 'Failed to save address';
        if (data.details && Array.isArray(data.details)) {
          msg = `Validation failed: ${data.details.join(', ')}`;
        }
        throw new Error(msg);
      }

      onSuccess(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
        <MapPin className="w-5 h-5 text-blue-600" />
        <h3>{initialData ? 'Edit Address' : 'Add New Address'}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              required
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="Full Name"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              required
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="e.g. +91 9876543210"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Address Line 1 */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Address Line 1</label>
          <input
            required
            name="address_line1"
            value={formData.address_line1}
            onChange={handleChange}
            placeholder="Flat, House no., Building, Company, Apartment"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        {/* Address Line 2 */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Address Line 2 (Area, Street, Village)</label>
          <input
            name="address_line2"
            value={formData.address_line2}
            onChange={handleChange}
            placeholder="Area, Street, Sector, Village"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Landmark */}
          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Landmark</label>
            <div className="relative">
              <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                placeholder="Near Apollo Hospital"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Pincode */}
          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pincode</label>
            <input
              required
              name="pincode"
              value={formData.pincode}
              onChange={handleChange}
              placeholder="6-digit Pincode"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">City</label>
            <input
              required
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="City/Town"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">State</label>
            <input
              required
              name="state"
              value={formData.state}
              onChange={handleChange}
              placeholder="State"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Country</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
            >
              <option value="India">India</option>
              {/* Add more as needed */}
            </select>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-2">
          {['home', 'work', 'other'].map(lab => (
            <button
              key={lab}
              type="button"
              onClick={() => setFormData(p => ({ ...p, label: lab }))}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                formData.label === lab 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {lab.charAt(0).toUpperCase() + lab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            id="is_default"
            type="checkbox"
            name="is_default"
            checked={formData.is_default}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="is_default" className="text-sm font-medium text-slate-700">Set as default address</label>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading || externalLoading}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Address' : 'Save Address'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
