/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileText, Signature, CheckSquare, AlertCircle } from 'lucide-react';

interface CodeOfConductProps {
  currentSignature?: string;
  onSign: (signatureName: string) => void;
  isSigned: boolean;
  signedAt?: string;
}

export const CODE_OF_CONDUCT_TEXT = `
FESTIVAL STAFF CODE OF CONDUCT

1. PROFESSIONAL CONDUCT & REPRESENTATION
All staff represent the festival. You must behave professionally, respectfully, and in a welcoming manner toward festival-goers, performers, contractors, and fellow team members. We enforce a zero-tolerance policy for harassment, discrimination, bullying, or disrespectful behavior of any kind.

2. SOBRIETY & SUBSTANCE POLICY
You are strictly forbidden from consuming alcohol or recreational drugs prior to or during your shifts. Any staff member found to be working under the influence of alcohol or prohibited substances will be immediately dismissed from their role and escorted from the festival site.

3. PUNCTUALITY, ATTENDANCE & SHIFTS
Staff must arrive at their designated check-in point at least 15 minutes prior to their scheduled shift start. If you are delayed or unable to work due to emergency, you must notify your Team Leader or the Staff Coordinator immediately. Repeated unexcused lateness may result in shift cancellation.

4. SAFETY, HEALTH & WELFARE
Your safety and the safety of our guests are paramount. 
- You must follow all instructions given by security personnel and health & safety officers.
- Wear your provided high-visibility vests or staff t-shirts at all times while on shift.
- Familiarize yourself with emergency exits, first-aid locations, and fire points.
- Promptly report any serious hazards, suspicious packages, or minor incidents to your manager.

5. HEALTH & ALLERGIES ACCURACY
You must ensure that all details provided in your onboarding profile—including emergency contacts, serious allergies, and medical conditions impacting work—are accurate and up to date.

6. CONFIDENTIALITY & SOCIAL MEDIA
- Do not disclose confidential information regarding festival operations, artist schedules, VIP locations, or internal security details.
- Avoid engaging with press or media regarding incidents; redirect any journalists to the official press office.
- Be mindful when posting on social media; do not post photos of backstage areas, restricted zones, or artist dressing rooms.
`;

export const CodeOfConduct: React.FC<CodeOfConductProps> = ({
  currentSignature = '',
  onSign,
  isSigned,
  signedAt
}) => {
  const [signatureName, setSignatureName] = useState(currentSignature);
  const [hasRead, setHasRead] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasRead) {
      setError('You must confirm that you have read and understood the entire document.');
      return;
    }
    if (!signatureName.trim()) {
      setError('Please type your full legal name as your electronic signature.');
      return;
    }
    setError('');
    onSign(signatureName.trim());
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="coc-container">
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Festival Staff Code of Conduct</h3>
            <p className="text-xs text-slate-500">Must be signed prior to shift allocation and check-in</p>
          </div>
        </div>
        {isSigned ? (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Signed & Active
          </span>
        ) : (
          <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            Pending Signature
          </span>
        )}
      </div>

      <div className="p-6">
        <div className="bg-slate-900 text-slate-200 p-5 rounded-xl font-mono text-xs leading-relaxed max-h-72 overflow-y-auto mb-6 border border-slate-800">
          <pre className="whitespace-pre-wrap font-sans text-sm">{CODE_OF_CONDUCT_TEXT}</pre>
        </div>

        {isSigned ? (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Digitally Signed By</p>
              <p className="text-slate-800 font-medium font-serif italic text-lg mt-0.5">"{currentSignature || signatureName}"</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Signed On</p>
              <p className="text-slate-600 text-sm font-medium mt-0.5">
                {signedAt ? new Date(signedAt).toLocaleString() : new Date().toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer group p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
              <input
                type="checkbox"
                checked={hasRead}
                onChange={(e) => setHasRead(e.target.checked)}
                className="mt-1 w-4 h-4 text-slate-950 border-slate-300 rounded focus:ring-slate-950 focus:ring-offset-2"
              />
              <span className="text-sm text-slate-600 leading-normal select-none group-hover:text-slate-800">
                I have read the Code of Conduct document in full, understand the expectations of my role, and agree to adhere strictly to all terms, including the sobriety, safety, and punctuality policies.
              </span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Signature size={14} className="text-slate-400" />
                  Type Full Legal Name as Signature
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alice Vance"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm shadow-slate-900/10 flex items-center justify-center gap-2"
              >
                <CheckSquare size={16} />
                Sign Code of Conduct
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
