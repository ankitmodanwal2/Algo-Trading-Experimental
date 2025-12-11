import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const LinkBrokerModal = ({ isOpen, onClose, onSuccess }) => {
    const [selectedBroker, setSelectedBroker] = useState('angelone');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Unbreakable lock to prevent ghost requests
    const submitLock = useRef(false);

    const { register, handleSubmit, reset } = useForm();

    if (!isOpen) return null;

    const onSubmit = async (data, e) => {
        // Stop event propagation immediately
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // If lock is active or visual loading state is true, exit
        if (submitLock.current || isSubmitting) return;

        // Activate Lock
        submitLock.current = true;
        setIsSubmitting(true);

        try {
            let credentials = {};

            if (selectedBroker === 'angelone') {
                credentials = {
                    apiKey: data.apiKey,
                    clientCode: data.clientCode,
                    password: data.password,
                    totpKey: data.totpKey
                };
            } else if (selectedBroker === 'dhan') {
                credentials = {
                    clientId: data.clientCode,
                    accessToken: data.apiKey
                };
            } else if (selectedBroker === 'fyers') {
                credentials = {
                    appId: data.clientCode,
                    accessToken: data.apiKey
                };
            }

            const payload = {
                brokerId: selectedBroker,
                metadataJson: JSON.stringify({ name: data.name || 'Trading Account' }),
                credentialsJson: JSON.stringify(credentials)
            };

            const res = await api.post('/brokers/link', payload);

            if (res.status === 200) {
                toast.success(`${selectedBroker.toUpperCase()} Linked Successfully!`);
                reset();
                if (onSuccess) onSuccess(); // Refresh parent list
                onClose();
            }
        } catch (err) {
            console.error("Link Error:", err);
            const msg = err.response?.data?.message || 'Connection Failed. Check Credentials.';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
            // Release lock after a small delay to prevent rapid re-clicks
            setTimeout(() => {
                submitLock.current = false;
            }, 500);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-trade-panel border border-trade-border rounded-xl w-full max-w-md shadow-2xl">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-trade-border">
                    <h2 className="text-xl font-bold text-white">Link Broker Account</h2>
                    <button onClick={onClose} className="text-trade-muted hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                    {/* Broker Selector */}
                    <div>
                        <label className="block text-sm text-trade-muted mb-2">Select Broker</label>
                        <select
                            value={selectedBroker}
                            onChange={(e) => {
                                setSelectedBroker(e.target.value);
                                reset(); // Clear form when switching
                            }}
                            className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white focus:border-trade-primary outline-none"
                        >
                            <option value="angelone">Angel One</option>
                            <option value="dhan">Dhan</option>
                            <option value="fyers">Fyers (Coming Soon)</option>
                        </select>
                    </div>

                    {/* --- ANGEL ONE FIELDS --- */}
                    {selectedBroker === 'angelone' && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-sm text-trade-muted mb-1">Account Alias</label>
                                <input {...register('name')} placeholder="e.g. My Main Account" className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-trade-muted mb-1">Client ID</label>
                                    <input {...register('clientCode', { required: true })} placeholder="A12345" className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm text-trade-muted mb-1">MPIN</label>
                                    <input type="password" {...register('password', { required: true })} placeholder="****" className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-trade-muted mb-1">TOTP Secret (Base32)</label>
                                <input {...register('totpKey', { required: true })} placeholder="JBSWY3..." className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white" />
                            </div>

                            <div>
                                <label className="block text-sm text-trade-muted mb-1">SmartAPI Key</label>
                                <input {...register('apiKey', { required: true })} placeholder="UUID String" className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white" />
                            </div>
                        </div>
                    )}

                    {/* --- DHAN FIELDS --- */}
                    {selectedBroker === 'dhan' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-200">
                                Dhan integration requires an Access Token valid for 30 days.
                            </div>

                            <div>
                                <label className="block text-sm text-trade-muted mb-1">Account Alias</label>
                                <input {...register('name')} placeholder="Dhan Portfolio" className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white" />
                            </div>

                            <div>
                                <label className="block text-sm text-trade-muted mb-1">Client ID</label>
                                <input {...register('clientCode', { required: true })} placeholder="10000001" className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white" />
                            </div>

                            <div>
                                <label className="block text-sm text-trade-muted mb-1">Access Token</label>
                                <textarea
                                    {...register('apiKey', { required: true })}
                                    placeholder="Paste the long JWT token from Dhan Web here..."
                                    className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white h-24 text-xs font-mono"
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-lg text-trade-muted hover:bg-trade-bg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-trade-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Connect'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LinkBrokerModal;