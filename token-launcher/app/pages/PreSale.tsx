import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase'; // Update the path as needed
import { savePresaleLaunch } from '../firebase';

interface Token {
  id: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
}

interface Whitelist {
  whitelistSaleLimit: string;
  whitelistSalePrice: string;
  whitelistMinBuy: string;
  whitelistMaxBuy: string;
  whitelistAddresses: string[];
}

interface LaunchData {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  paymentCurrency: string;
  lpLaunchPrice: string;
  softcap: string;
  hardcap: string;
  preSaleLimit: string;
  publicStartDate: string | null;
  publicEndDate: string | null;
  hasWhitelist: boolean;
  whitelist: Whitelist | null;
  saleName: string;
  saleDescription: string;
  twitterId: string;
  telegramId: string;
  website: string;
  createdAt: string;
  status: string;
  salePrice?: string;
  minBuy?: string;
  maxBuy?: string;
}

const TokenPresalePage = () => {
  const [stage, setStage] = useState<number>(1);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingTokens, setLoadingTokens] = useState<boolean>(true);
  const [walletAddress, setWalletAddress] = useState<string>('');
  
  // Stage 1 state
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [paymentCurrency, setPaymentCurrency] = useState<string>('Eth Sepolia');
  const [salePrice, setSalePrice] = useState<string>('');
  const [lpLaunchPrice, setLpLaunchPrice] = useState<string>('');
  const [minBuy, setMinBuy] = useState<string>('');
  const [maxBuy, setMaxBuy] = useState<string>('');
  const [softcap, setSoftcap] = useState<string>('');
  const [hardcap, setHardcap] = useState<string>('');
  const [preSaleLimit, setPreSaleLimit] = useState<string>('');
  
  // Stage 2 state
  const [publicStartDate, setPublicStartDate] = useState<string>('');
  const [publicStartTime, setPublicStartTime] = useState<string>('');
  const [publicStartAMPM, setPublicStartAMPM] = useState<string>('AM');
  const [publicEndDate, setPublicEndDate] = useState<string>('');
  const [publicEndTime, setPublicEndTime] = useState<string>('');
  const [publicEndAMPM, setPublicEndAMPM] = useState<string>('AM');
  const [hasWhitelist, setHasWhitelist] = useState<boolean>(false);
  const [whitelistSaleLimit, setWhitelistSaleLimit] = useState<string>('');
  const [whitelistSalePrice, setWhitelistSalePrice] = useState<string>('');
  const [whitelistMinBuy, setWhitelistMinBuy] = useState<string>('');
  const [whitelistMaxBuy, setWhitelistMaxBuy] = useState<string>('');
  const [whitelistAddresses, setWhitelistAddresses] = useState<string[]>(['']);
  const [whitelistAddressErrors, setWhitelistAddressErrors] = useState<boolean[]>([]);
  
  // Stage 3 state
  const [saleName, setSaleName] = useState<string>('');
  const [saleDescription, setSaleDescription] = useState<string>('');
  const [twitterId, setTwitterId] = useState<string>('');
  const [telegramId, setTelegramId] = useState<string>('');
  const [website, setWebsite] = useState<string>('');

  useEffect(() => {
    // Fetch tokens from Firebase
    const tokensRef = ref(database, 'tokens');
    onValue(tokensRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTokens(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const detectWallet = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          } else {
            // Request connection if not connected
            const requestedAccounts = await window.ethereum.request({ 
              method: 'eth_requestAccounts' 
            });
            if (requestedAccounts.length > 0) {
              setWalletAddress(requestedAccounts[0]);
            }
          }
        } catch (error) {
          console.error('Error detecting wallet:', error);
        }
      }
    };

    detectWallet();

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
      } else {
        setWalletAddress('');
        setTokens([]);
      }
    };

    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setTokens([]);
      setLoadingTokens(false);
      return;
    }

    setLoadingTokens(true);
    const tokensRef = ref(database, `users/${walletAddress}/tokens`);
    
    const unsubscribe = onValue(tokensRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const tokensArray = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<Token, 'id'>)
          }));
          setTokens(tokensArray);
        } else {
          setTokens([]);
        }
      } catch (error) {
        console.error('Error processing tokens:', error);
        setTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    });

    return () => unsubscribe();
  }, [walletAddress]);

  const handleAddWhitelistAddress = () => {
    setWhitelistAddresses([...whitelistAddresses, '']);
    setWhitelistAddressErrors([...whitelistAddressErrors, false]);
  };

  const handleRemoveWhitelistAddress = (index: number) => {
    const newAddresses = [...whitelistAddresses];
    newAddresses.splice(index, 1);
    setWhitelistAddresses(newAddresses);
    
    const newErrors = [...whitelistAddressErrors];
    newErrors.splice(index, 1);
    setWhitelistAddressErrors(newErrors);
  };

  // Ethereum address validation
  const isValidEthAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  };

  const handleWhitelistAddressChange = (index: number, value: string) => {
    const newAddresses = [...whitelistAddresses];
    newAddresses[index] = value;
    setWhitelistAddresses(newAddresses);

    // Validate address
    const errors = [...whitelistAddressErrors];
    errors[index] = value && !isValidEthAddress(value) ? true : false;
    setWhitelistAddressErrors(errors);
  };

  const validateStage1 = (): boolean => {
    return (
      !!selectedToken &&
      !!paymentCurrency &&
      !!salePrice &&
      !!lpLaunchPrice &&
      !!minBuy &&
      !!maxBuy &&
      !!softcap &&
      !!hardcap &&
      !!preSaleLimit
    );
  };

  const validateStage2 = (): boolean => {
    const validDates = !!publicStartDate && !!publicStartTime && !!publicEndDate && !!publicEndTime;
    if (!hasWhitelist) return validDates;
    
    // Check all whitelist addresses are valid
    const allValid = whitelistAddresses.every(addr => isValidEthAddress(addr));
    return (
      validDates &&
      !!whitelistSaleLimit &&
      !!whitelistSalePrice &&
      !!whitelistMinBuy &&
      !!whitelistMaxBuy &&
      whitelistAddresses.every(addr => addr.trim() !== '') &&
      allValid
    );
  };

  const validateStage3 = (): boolean => {
    return (
      !!saleName &&
      !!saleDescription &&
      !!twitterId &&
      !!telegramId
    );
  };

  const handleContinue = () => {
    if (stage === 1 && !validateStage1()) {
      alert('Please fill all fields in Stage 1');
      return;
    }
    if (stage === 2 && !validateStage2()) {
      alert('Please fill all required fields in Stage 2');
      return;
    }
    if (stage === 3 && !validateStage3()) {
      alert('Please fill all required fields in Stage 3');
      return;
    }
    setStage(stage + 1);
  };

  const handleBack = () => {
    setStage(stage - 1);
  };

  const handleLaunch = async () => {
    if (!validateStage1() || !validateStage2() || !validateStage3()) {
      alert('Please complete all required fields');
      return;
    }

    // Max buy must be more than min buy (sale parameter)
    if (!hasWhitelist && Number(maxBuy) <= Number(minBuy)) {
      alert('Maximum Buy must be greater than Minimum Buy in Sale Parameters.');
      return;
    }
    // Pre-sale limit must be greater than max buy
    if (!hasWhitelist && Number(preSaleLimit) <= Number(maxBuy)) {
      alert('Pre-Sale Limit must be greater than Maximum Buy.');
      return;
    }
    // Max buy must be more than min buy (whitelist)
    if (hasWhitelist && Number(whitelistMaxBuy) <= Number(whitelistMinBuy)) {
      alert('Whitelist Maximum Buy must be greater than Whitelist Minimum Buy.');
      return;
    }
    // Whitelist sale limit must be greater than whitelist max buy
    if (hasWhitelist && Number(whitelistSaleLimit) <= Number(whitelistMaxBuy)) {
      alert('Whitelist Sale Limit must be greater than Whitelist Maximum Buy.');
      return;
    }
    // Twitter handle must start with https://x.com/
    if (!twitterId.startsWith('https://x.com/')) {
      alert('Twitter handle must start with "https://x.com/"');
      return;
    }
    // Telegram handle must start with https://t.me/
    if (!telegramId.startsWith('https://t.me/')) {
      alert('Telegram handle must start with "https://t.me/"');
      return;
    }
    // Website must start with https:// (if provided)
    if (website && !website.startsWith('https://')) {
      alert('Website must start with "https://"');
      return;
    }

    if (!walletAddress) {
      alert('Wallet not connected');
      return;
    }

    // Check that publicStartDate/publicStartTime/publicStartAMPM is not in the past
    const getStartDateObj = (): Date | null => {
      if (!publicStartDate || !publicStartTime || !publicStartAMPM) return null;
      let [year, month, day] = publicStartDate.split('-');
      let [hour, minute] = publicStartTime.split(':');
      hour = parseInt(hour, 10);
      minute = parseInt(minute, 10);
      if (publicStartAMPM === 'PM' && hour < 12) hour += 12;
      if (publicStartAMPM === 'AM' && hour === 12) hour = 0;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, minute, 0);
    };
    
    const getEndDateObj = (): Date | null => {
      if (!publicEndDate || !publicEndTime || !publicEndAMPM) return null;
      let [year, month, day] = publicEndDate.split('-');
      let [hour, minute] = publicEndTime.split(':');
      hour = parseInt(hour, 10);
      minute = parseInt(minute, 10);
      if (publicEndAMPM === 'PM' && hour < 12) hour += 12;
      if (publicEndAMPM === 'AM' && hour === 12) hour = 0;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, minute, 0);
    };
    
    const startDateObj = getStartDateObj();
    const endDateObj = getEndDateObj();
    if (startDateObj && startDateObj < new Date()) {
      alert('Public Start Date & Time cannot be in the past.');
      return;
    }
    if (startDateObj && endDateObj && endDateObj <= startDateObj) {
      alert('Public End Date & Time must be after the Public Start Date & Time.');
      return;
    }

    // Hard cap must be greater than soft cap
    if (Number(hardcap) <= Number(softcap)) {
      alert('Hardcap must be greater than Softcap.');
      return;
    }

    try {
      // Find selected token object
      const selectedTokenObj = tokens.find(token => (token.tokenAddress || token.id) === selectedToken);
      const launchData: LaunchData = {
        // Stage 1 data
        tokenAddress: selectedToken,
        tokenName: selectedTokenObj?.tokenName || '',
        tokenSymbol: selectedTokenObj?.tokenSymbol || '',
        paymentCurrency,
        lpLaunchPrice,
        softcap,
        hardcap,
        preSaleLimit,
        // Stage 2 data
        publicStartDate: formatDateTime(publicStartDate, publicStartTime, publicStartAMPM),
        publicEndDate: formatDateTime(publicEndDate, publicEndTime, publicEndAMPM),
        hasWhitelist,
        whitelist: hasWhitelist
          ? {
              whitelistSaleLimit,
              whitelistSalePrice,
              whitelistMinBuy,
              whitelistMaxBuy,
              whitelistAddresses,
            }
          : null,
        // Stage 3 data
        saleName,
        saleDescription,
        twitterId,
        telegramId,
        website: website || '',
        // Metadata
        createdAt: new Date().toISOString(),
        status: 'pending', // You can add status tracking
      };
      
      if (!hasWhitelist) {
        launchData.salePrice = salePrice;
        launchData.minBuy = minBuy;
        launchData.maxBuy = maxBuy;
      }

      // Save to Firebase
      const launchId = await savePresaleLaunch(walletAddress, launchData);

      alert(`Presale launched successfully! ID: ${launchId}`);
      window.location.reload();
      // You might want to redirect or reset the form here
    } catch (error) {
      console.error('Error launching presale:', error);
      alert('Failed to launch presale. Please try again.');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading tokens...</div>;
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900 py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl sm:rounded-3xl backdrop-blur-sm border border-slate-700/50 p-6 sm:p-8 shadow-2xl">
        <div className="flex justify-between mb-8 sm:mb-12">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  stage >= step
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                }`}
              >
                {step}
              </div>
              <span className="text-sm mt-2 text-slate-300 font-semibold">Stage {step}</span>
            </div>
          ))}
        </div>

        {stage === 1 && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Token & Sale Parameters
            </h2>
            <div className="space-y-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Select Token
                </label>
                {!walletAddress ? (
                  <div className="w-full p-4 border border-slate-700/50 rounded-xl bg-slate-800/30 text-yellow-200 backdrop-blur-sm">
                    Please connect your wallet to view your tokens
                  </div>
                ) : loadingTokens ? (
                  <div className="w-full p-4 border border-slate-700/50 rounded-xl bg-slate-800/30 text-slate-300 backdrop-blur-sm">
                    Loading your tokens...
                  </div>
                ) : tokens.length === 0 ? (
                  <div className="w-full p-4 border border-slate-700/50 rounded-xl bg-slate-800/30 text-cyan-400 backdrop-blur-sm">
                    No tokens found. Please create a token first.
                  </div>
                ) : (
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                    required
                  >
                    <option value="">Select a token</option>
                    {tokens.map((token) => (
                      <option key={token.id} value={token.tokenAddress || token.id}>
                        {token.tokenName || `Token ${token.id}`} ({token.tokenSymbol || 'No symbol'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Payment Currency
                </label>
                <select
                  value={paymentCurrency}
                  onChange={(e) => setPaymentCurrency(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  required
                >
                  <option value="Eth Sepolia">Eth Sepolia</option>
                  <option value="Linea Sepolia">Linea Sepolia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Sale Price (ETH)
                </label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="0.0001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  LP Launch Price (ETH)
                </label>
                <input
                  type="number"
                  value={lpLaunchPrice}
                  onChange={(e) => setLpLaunchPrice(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="0.0002"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Minimum Buy (ETH)
                </label>
                <input
                  type="number"
                  value={minBuy}
                  onChange={(e) => setMinBuy(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Maximum Buy (ETH)
                </label>
                <input
                  type="number"
                  value={maxBuy}
                  onChange={(e) => setMaxBuy(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Softcap (ETH)
                </label>
                <input
                  type="number"
                  value={softcap}
                  onChange={(e) => setSoftcap(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Hardcap (ETH)
                </label>
                <input
                  type="number"
                  value={hardcap}
                  onChange={(e) => setHardcap(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Pre-Sale Limit (ETH)
                </label>
                <input
                  type="number"
                  min={0}
                  value={preSaleLimit}
                  onChange={(e) => setPreSaleLimit(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="Enter Pre-Sale Limit"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {stage === 2 && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Sale Schedule & Whitelist
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Public Start Date (IST)
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={publicStartDate}
                    onChange={(e) => setPublicStartDate(e.target.value)}
                    className="p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                    required
                  />
                  <input
                    type="time"
                    value={publicStartTime}
                    onChange={(e) => setPublicStartTime(e.target.value)}
                    className="p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                    required
                  />
                  <select
                    value={publicStartAMPM}
                    onChange={(e) => setPublicStartAMPM(e.target.value)}
                    className="p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Public End Date (IST)
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={publicEndDate}
                    onChange={(e) => setPublicEndDate(e.target.value)}
                    className="p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                    required
                  />
                  <input
                    type="time"
                    value={publicEndTime}
                    onChange={(e) => setPublicEndTime(e.target.value)}
                    className="p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                    required
                  />
                  <select
                    value={publicEndAMPM}
                    onChange={(e) => setPublicEndAMPM(e.target.value)}
                    className="p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hasWhitelist"
                  checked={hasWhitelist}
                  onChange={(e) => setHasWhitelist(e.target.checked)}
                  className="w-5 h-5 text-cyan-500 bg-slate-800/50 border-slate-700/50 rounded focus:ring-cyan-500"
                />
                <label htmlFor="hasWhitelist" className="ml-2 text-sm font-semibold text-slate-300">
                  Enable Whitelist Phase
                </label>
              </div>

              {hasWhitelist && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Whitelist Sale Limit (ETH)
                    </label>
                    <input
                      type="number"
                      value={whitelistSaleLimit}
                      onChange={(e) => setWhitelistSaleLimit(e.target.value)}
                      className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                      placeholder="50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Whitelist Sale Price (ETH)
                    </label>
                    <input
                      type="number"
                      value={whitelistSalePrice}
                      onChange={(e) => setWhitelistSalePrice(e.target.value)}
                      className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                      placeholder="0.00005"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Whitelist Minimum Buy (ETH)
                    </label>
                    <input
                      type="number"
                      value={whitelistMinBuy}
                      onChange={(e) => setWhitelistMinBuy(e.target.value)}
                      className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                      placeholder="0.005"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Whitelist Maximum Buy (ETH)
                    </label>
                    <input
                      type="number"
                      value={whitelistMaxBuy}
                      onChange={(e) => setWhitelistMaxBuy(e.target.value)}
                      className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                      placeholder="0.5"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Whitelisted Addresses
                    </label>
                    {whitelistAddresses.map((address, index) => (
                      <div key={index} className="flex flex-col mb-3">
                        <div className="flex">
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => handleWhitelistAddressChange(index, e.target.value)}
                            className={`flex-1 p-3 border ${
                              whitelistAddressErrors[index] ? 'border-red-500' : 'border-slate-700/50'
                            } rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300`}
                            placeholder="0x..."
                            required
                          />
                          {whitelistAddresses.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveWhitelistAddress(index)}
                              className="ml-2 px-3 bg-gradient-to-r from-red-600/60 to-red-700/60 text-white rounded-xl hover:bg-red-700 transition-all duration-300"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {whitelistAddressErrors[index] && (
                          <span className="text-red-500 text-xs mt-1">Enter valid wallet address</span>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddWhitelistAddress}
                      className="mt-2 px-4 py-2 bg-gradient-to-r from-cyan-600/60 to-blue-600/60 text-white rounded-xl hover:bg-cyan-600 transition-all duration-300"
                    >
                      + Add Address
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {stage === 3 && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Sale Information
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Sale Name
                </label>
                <input
                  type="text"
                  value={saleName}
                  onChange={(e) => setSaleName(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="My Awesome Token Presale"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Sale Description
                </label>
                <textarea
                  value={saleDescription}
                  onChange={(e) => setSaleDescription(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  rows={4}
                  placeholder="Describe your token and presale details..."
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Twitter ID
                </label>
                <input
                  type="text"
                  value={twitterId}
                  onChange={(e) => setTwitterId(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="@mytoken"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Telegram ID
                </label>
                <input
                  type="text"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="@mytokenchat"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Website (optional)
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full p-3 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                  placeholder="https://mytoken.com"
                />
              </div>
            </div>
          </div>
        )}

        {stage === 4 && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Presale Overview
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 text-white">Token & Sale Parameters</h3>
                <div className="bg-slate-800/30 p-4 sm:p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                  <p className="text-slate-300"><span className="font-semibold">Token:</span> {selectedToken}</p>
                  <p className="text-slate-300"><span className="font-semibold">Payment Currency:</span> {paymentCurrency}</p>
                  {!hasWhitelist && (
                    <>
                      <p className="text-slate-300"><span className="font-semibold">Sale Price:</span> {salePrice} ETH</p>
                      <p className="text-slate-300"><span className="font-semibold">Minimum Buy:</span> {minBuy} ETH</p>
                      <p className="text-slate-300"><span className="font-semibold">Maximum Buy:</span> {maxBuy} ETH</p>
                    </>
                  )}
                  <p className="text-slate-300"><span className="font-semibold">LP Launch Price:</span> {lpLaunchPrice} ETH</p>
                  <p className="text-slate-300"><span className="font-semibold">Softcap:</span> {softcap} ETH</p>
                  <p className="text-slate-300"><span className="font-semibold">Hardcap:</span> {hardcap} ETH</p>
                  <p className="text-slate-300"><span className="font-semibold">Pre-Sale Limit:</span> {preSaleLimit} ETH</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 text-white">Sale Schedule</h3>
                <div className="bg-slate-800/30 p-4 sm:p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                  <p className="text-slate-300"><span className="font-semibold">Public Start Date:</span> {publicStartDate}</p>
                  <p className="text-slate-300"><span className="font-semibold">Public End Date:</span> {publicEndDate}</p>
                  {hasWhitelist && (
                    <>
                      <p className="text-slate-300"><span className="font-semibold">Whitelist Sale Limit:</span> {whitelistSaleLimit} ETH</p>
                      <p className="text-slate-300"><span className="font-semibold">Whitelist Sale Price:</span> {whitelistSalePrice} ETH</p>
                      <p className="text-slate-300"><span className="font-semibold">Whitelist Minimum Buy:</span> {whitelistMinBuy} ETH</p>
                      <p className="text-slate-300"><span className="font-semibold">Whitelist Maximum Buy:</span> {whitelistMaxBuy} ETH</p>
                      <div>
                        <span className="font-semibold text-slate-300">Whitelisted Addresses:</span>
                        <ul className="list-disc pl-5 mt-1 text-slate-300">
                          {whitelistAddresses.map((addr, i) => (
                            <li key={i} className="break-all">{addr}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 text-white">Sale Information</h3>
                <div className="bg-slate-800/30 p-4 sm:p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                  <p className="text-slate-300"><span className="font-semibold">Sale Name:</span> {saleName}</p>
                  <p className="text-slate-300"><span className="font-semibold">Description:</span> {saleDescription}</p>
                  <p className="text-slate-300"><span className="font-semibold">Twitter:</span> {twitterId}</p>
                  <p className="text-slate-300"><span className="font-semibold">Telegram:</span> {telegramId}</p>
                  {website && <p className="text-slate-300"><span className="font-semibold">Website:</span> {website}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8 sm:mt-12">
          {stage > 1 && (
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 text-slate-300 rounded-xl hover:bg-slate-700 transition-all duration-300"
            >
              Back
            </button>
          )}
          {stage < 4 ? (
            <button
              onClick={handleContinue}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600/60 to-blue-600/60 text-white rounded-xl hover:bg-cyan-600 transition-all duration-300 ml-auto"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              className="px-6 py-3 bg-gradient-to-r from-blue-600/60 to-cyan-600/60 text-white rounded-xl hover:bg-blue-600 transition-all duration-300 ml-auto"
            >
              Launch Presale
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to format date, time, AM/PM as 'DD/MM/YYYY HH:mm AM/PM'
const formatDateTime = (date: string, time: string, ampm: string): string | null => {
  if (!date || !time || !ampm) return null;
  // date: 'YYYY-MM-DD', time: 'HH:mm', ampm: 'AM'/'PM'
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} ${time} ${ampm}`;
};

export default TokenPresalePage;