/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, User, LogIn, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { loginWithGoogle } from '../utils/googleAuth';

interface LoginScreenProps {
  onLoginSuccess: (email: string, role: 'admin' | 'staff', googleToken?: string | null) => void;
  staffProfiles: any[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  staffProfiles
}) => {
  const [showPasscodeForm, setShowPasscodeForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState('dayne@savourfestival.com');
  const [adminCode, setAdminCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const result = await loginWithGoogle();
      if (result) {
        const authenticatedEmail = result.user.email?.toLowerCase().trim();
        if (!authenticatedEmail) {
          throw new Error("Unable to retrieve email from your Google Account.");
        }

        // Check if this email is an admin
        if (authenticatedEmail === 'dayne@savourfestival.com') {
          onLoginSuccess(authenticatedEmail, 'admin', result.accessToken);
          return;
        }

        // Check if registered in staff profiles
        const matchedProfile = staffProfiles.find(
          (p) => p.email.toLowerCase().trim() === authenticatedEmail
        );

        if (matchedProfile) {
          // Check if admin role
          const role = matchedProfile.role || 'staff';
          onLoginSuccess(authenticatedEmail, role, result.accessToken);
        } else {
          // Not registered
          setLoginError(
            `The Google Account "${authenticatedEmail}" is not registered on this portal. If you're a new candidate, please click the secure onboarding registration link sent in your invitation email first.`
          );
        }
      }
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || 'Google Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminPasscodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const emailClean = adminEmail.trim().toLowerCase();
    
    // Check bootstrap credentials
    if (emailClean === 'dayne@savourfestival.com' && adminCode === 'admin2026') {
      onLoginSuccess(emailClean, 'admin', null);
      return;
    }

    // Check other registered admins if any
    const matchedProfile = staffProfiles.find(
      (p) => p.email.toLowerCase().trim() === emailClean && p.role === 'admin'
    );

    if (matchedProfile && adminCode === 'admin2026') {
      onLoginSuccess(emailClean, 'admin', null);
      return;
    }

    setLoginError('Invalid Administrator credentials or access code. Please check your entry.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 select-none font-sans" id="login-container">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 space-y-6 md:space-y-8 animate-fade-in">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 bg-slate-900 text-white rounded-2xl items-center justify-center font-black text-2xl shadow-md shadow-slate-900/25">
            🎪
          </div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-950 tracking-tight">
              Savour Staff Portal
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Onboarding & Shift Coordination
            </p>
          </div>
        </div>

        {/* Error Notice */}
        {loginError && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-xs md:text-sm leading-relaxed flex items-start gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="font-semibold">{loginError}</div>
          </div>
        )}

        {/* Unified Login Area */}
        <div className="space-y-6">
          {/* Primary Action: Google Single Sign-On */}
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-bold text-slate-800">Secure Single Sign-On</h2>
              <p className="text-xs text-slate-400">For all staff candidates and Coordinator HQ admins</p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-slate-900/10 cursor-pointer flex items-center justify-center gap-3 active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              {isLoading ? 'Connecting...' : 'Sign In with Google'}
            </button>
          </div>

          {/* Fallback Option Toggle */}
          <div className="pt-2 text-center border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowPasscodeForm(!showPasscodeForm);
                setLoginError(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center gap-1.5 mx-auto cursor-pointer transition-colors"
            >
              <Shield size={13} className="text-slate-400" />
              {showPasscodeForm ? 'Hide Admin Passcode Login' : 'Sign in with Coordinator Passcode fallback'}
            </button>
          </div>

          {/* Admin Passcode Fallback Form */}
          {showPasscodeForm && (
            <form onSubmit={handleAdminPasscodeLogin} className="space-y-4 pt-2 border-t border-dashed border-slate-200/60 animate-slide-down" id="admin-login-fallback">
              <div className="text-center space-y-1 mb-2">
                <h3 className="text-xs font-bold text-slate-700">Coordinator Passcode Fallback</h3>
                <p className="text-[10px] text-slate-400">Access Festival HQ operations via email & passcode when needed</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administrator Email</label>
                <input
                  type="email"
                  required
                  placeholder="dayne@savourfestival.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">HQ Operations Access Code</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none bg-slate-50/50 tracking-widest font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-3"
              >
                <LogIn size={13} />
                Verify & Launch HQ
              </button>
            </form>
          )}

          {/* Helpful Tips / Info box */}
          <div className="p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl text-[11px] leading-relaxed text-indigo-950 flex gap-2">
            <Sparkles size={14} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">First time logging in?</span> Candidate staff profiles must first be registered via invitation sent by an administrator. Once onboarded, your Google Account becomes active for secure instant access.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 font-medium pt-2">
          © 2026 Savour Food Festival. Securely hosted operations engine.
        </div>
      </div>
    </div>
  );
};
