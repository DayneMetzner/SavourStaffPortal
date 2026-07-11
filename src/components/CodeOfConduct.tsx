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
FUME Staff Code of Conduct (On-Site Behaviour & Alcohol)

This brief applies to all FUME staff, brand ambassadors, contractors and volunteers working on site.

1. Behaviour on Site
• You are representing FUME and BBQ Festivals Ltd from the moment you arrive on site until you leave.
• We expect you to be switched on, outwardly positive and professional at all times, in front of guests, traders, sponsors, venue staff and each other.
• Respect the management and venue, follow instructions from managers and security, and keep all areas tidy and safe.

2. Alcohol & Substance Policy
• No alcohol during your shift. This is non-negotiable.
• At the end of your shift, you are welcome to stay, have a drink and enjoy the event, but:
  - You must remove all uniform / lanyards / high-vis before drinking.
  - You must remain respectful and in control – you are still associated with the festival.
• Being hungover or unfit for work is not acceptable.
  - If you arrive unfit to work, you may be stood down and removed from the staff list and will be asked to leave without pay.
• The possession or use of illegal substances on site will result in immediate removal and may be reported further.

3. Professionalism & Respect
Professional behaviour towards sponsors, traders, attendees, venue staff, security and our internal team is the bare minimum.
The following are strictly unacceptable and will result in the immediate termination of your association with FUME / BBQ Festivals Ltd:
• Aggressive, threatening or confrontational behaviour
• Harassment of any kind (verbal, physical, sexual or online)
• Inappropriate comments, touching or jokes that could make anyone feel uncomfortable
• Discriminatory language or behaviour (race, gender, sexuality, religion, disability, etc.)
• Bullying or undermining colleagues, traders or venue staff
If in doubt, don’t say it, don’t do it.

4. After-Shift Conduct
• Even off the clock, if you are in or around the venue, people will still see you as "FUME staff".
• Keep behaviour respectful, avoid getting visibly drunk, and follow any instructions from security and management.
• Any post-shift behaviour that reflects badly on the festival will be treated as an on-shift issue.

5. Reporting Issues
If you see or experience anything that feels:
• Unprofessional
• Aggressive
• Inappropriate
• Or makes you or someone else feel uncomfortable

You must report it immediately to the Event Directors: Dan Bentely, Dayne Metzner, or VE Manager Jasper Rayan Cater.
• All reports will be taken seriously and handled as quickly and discreetly as possible.
• There is zero tolerance for retaliation against anyone who raises a concern.

6. Final Word
We don’t see any of this as a big ask. It’s a very positive event and we ask that you respect and professionalism so everyone can work hard, have fun and be proud of the event.

By working at FUME, you are agreeing to stick to this Code of Conduct for the duration of the event.
`;

export const CodeOfConduct: React.FC<CodeOfConductProps> = ({
  currentSignature = '',
  onSign,
  isSigned,
  signedAt
}) => {
  const [signatureName, setSignatureName] = useState(currentSignature);
  const [hasRead, setHasRead] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [error, setError] = useState('');

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Check if user has scrolled to within 15px of the bottom
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 15;
    if (isAtBottom) {
      setScrolledToBottom(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrolledToBottom) {
      setError('You must scroll to the bottom of the Code of Conduct document before signing.');
      return;
    }
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
        <div 
          onScroll={handleScroll}
          className="bg-slate-900 text-slate-200 p-5 rounded-xl font-mono text-xs leading-relaxed max-h-72 overflow-y-auto mb-4 border border-slate-800"
        >
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

            {!scrolledToBottom && (
              <div className="flex items-center gap-1.5 p-2 bg-amber-50 text-amber-800 rounded-xl text-[11px] font-bold border border-amber-200/50">
                <AlertCircle size={14} className="text-amber-600" />
                Please scroll to the very bottom of the Code of Conduct document to unlock the checkbox.
              </div>
            )}

            <label className={`flex items-start gap-3 cursor-pointer group p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 ${!scrolledToBottom ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                checked={hasRead}
                disabled={!scrolledToBottom}
                onChange={(e) => setHasRead(e.target.checked)}
                className={`mt-1 w-4 h-4 rounded border-slate-300 focus:ring-slate-950 focus:ring-offset-2 ${!scrolledToBottom ? 'opacity-40 cursor-not-allowed text-slate-300' : 'text-slate-950 cursor-pointer'}`}
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
