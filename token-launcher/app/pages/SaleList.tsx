import React, { useEffect, useState } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { BrowserProvider } from 'ethers';
import { getAddress } from 'ethers';

// Type definitions
interface Sale {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress?: string;
  listingRate?: string;
  lpLaunchPrice?: string;
  softCap?: string;
  softcap?: string;
  hardCap?: string;
  hardcap?: string;
  startTime?: string | number;
  endTime?: string | number;
  publicStartDate?: string | number;
  publicEndDate?: string | number;
  createdBy?: string;
  hasWhitelist?: boolean;
  whitelist?: {
    whitelistAddresses: string[];
  };
}

interface SalesData {
  [user: string]: {
    launches: {
      [id: string]: Sale;
    };
  };
}

interface SaleListProps {
  onNavigate?: (path: string) => void;
}

const SaleList: React.FC<SaleListProps> = ({ onNavigate }) => {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Helper function to get current IST time
  const getCurrentISTTime = (): Date => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    return istTime;
  };

  // Helper function to parse date and convert to IST for comparison
  const parseToISTDate = (dateValue: string | number | undefined): Date | null => {
    if (!dateValue) return null;
    
    try {
      let date: Date;
      const customPattern = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}) (AM|PM)$/;
      
      if (typeof dateValue === 'string') {
        const customMatch = dateValue.match(customPattern);
        
        if (customMatch) {
          const [, day, month, year, hour, minute, ampm] = customMatch;
          let hour24 = parseInt(hour);
          if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
          if (ampm === 'AM' && hour24 === 12) hour24 = 0;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minute));
        } else {
          const localePattern = /^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)$/;
          if (localePattern.test(dateValue)) {
            date = new Date(dateValue);
          } else {
            date = new Date(dateValue);
            if (isNaN(date.getTime())) {
              const numericValue = Number(dateValue);
              if (!isNaN(numericValue)) {
                if (numericValue < 1000000000000) {
                  date = new Date(numericValue * 1000);
                } else {
                  date = new Date(numericValue);
                }
              }
            }
          }
        }
      } else if (typeof dateValue === 'number') {
        if (dateValue < 1000000000000) {
          date = new Date(dateValue * 1000);
        } else {
          date = new Date(dateValue);
        }
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      const year = date.getFullYear();
      if (year < 2020 || year > 2030) {
        console.warn(`Date ${dateValue} parsed to year ${year}, which seems invalid. Rejecting.`);
        return null;
      }
      
      return date;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  // Helper function to format date safely
  const formatDate = (dateValue: string | number | undefined): string => {
    if (!dateValue) return 'Not set';
    
    const parsedDate = parseToISTDate(dateValue);
    if (!parsedDate) return `Invalid date: ${dateValue}`;
    
    return parsedDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper function to check if sale is active based on IST
  const isSaleActive = (sale: Sale): boolean => {
    const currentIST = new Date();
    const startTime = parseToISTDate(sale.startTime || sale.publicStartDate);
    const endTime = parseToISTDate(sale.endTime || sale.publicEndDate);
    
    if (!startTime || !endTime) {
      console.warn(`Sale ${sale.id} has invalid dates:`, {
        startTime: sale.startTime || sale.publicStartDate,
        endTime: sale.endTime || sale.publicEndDate
      });
      return false;
    }
    
    console.log(`Sale ${sale.id} - Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}, Current: ${currentIST.toISOString()}`);
    
    const isActive = currentIST >= startTime && currentIST <= endTime;
    
    if (!isActive) {
      console.log(`Sale ${sale.id} is not active. Current: ${currentIST.toISOString()}, Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}`);
    }
    
    return isActive;
  };

  // Connect wallet using ethers v6
  const connectWallet = async (): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWalletAddress(address);
        setIsConnected(true);
      } else {
        setError("Please install MetaMask or another Ethereum wallet");
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setError(err.message || "Failed to connect wallet");
    }
  };

  useEffect(() => {
    const fetchSales = async (): Promise<void> => {
      try {
        setLoading(true);
        const allSalesRef = ref(database, 'sales');
        const allSalesSnap = await get(allSalesRef);
        let allSales: Sale[] = [];
        
        if (allSalesSnap.exists()) {
          const salesData: SalesData = allSalesSnap.val();
          Object.entries(salesData).forEach(([user, launches]) => {
            if (launches && launches.launches) {
              Object.entries(launches.launches).forEach(([id, data]) => {
                allSales.push({
                  id,
                  ...data,
                  startTime: data.startTime || data.publicStartDate,
                  endTime: data.endTime || data.publicEndDate,
                  createdBy: user
                });
              });
            }
          });
        }
        
        const whitelistFilteredSales = allSales.filter(sale => {
          if (!sale.hasWhitelist || !sale.whitelist) return true;
          if (!walletAddress) return false;
          const isCreator = sale.createdBy && sale.createdBy.toLowerCase() === walletAddress.toLowerCase();
          const isWhitelisted = Array.isArray(sale.whitelist.whitelistAddresses) && 
            sale.whitelist.whitelistAddresses.map(addr => addr.toLowerCase()).includes(walletAddress.toLowerCase());
          return isCreator || isWhitelisted;
        });
        
        const activeFilteredSales = whitelistFilteredSales.filter(sale => isSaleActive(sale));
        
        setSales(activeFilteredSales);
      } catch (err) {
        console.error('Error fetching sales:', err);
        setError('Failed to fetch sales data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSales();
  }, [walletAddress]);

  useEffect(() => {
    const checkWalletConnection = async (): Promise<void> => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_accounts", []);
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
          }
        } catch (err) {
          console.error("Error checking wallet connection:", err);
        }
      }
    };

    checkWalletConnection();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleViewDetails = (saleId: string): void => {
    if (onNavigate) {
      onNavigate(`/sale/${saleId}`);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/sale/${saleId}`;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-white text-lg font-medium">
        Loading sales...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400 text-lg font-medium">
        {error}
        {typeof window !== 'undefined' && !window.ethereum && (
          <div className="mt-4">
            <a 
              href="https://metamask.io/download.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors duration-300 font-medium underline"
            >
              Install MetaMask
            </a>
          </div>
        )}
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="text-center py-12 sm:pt-16 md:pl-[240px] sm:pb-12">
        <button
          onClick={connectWallet}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          Connect Wallet
        </button>
        <p className="mt-4 text-gray-300 text-base">Connect your wallet to view your sales</p>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="text-center py-12 sm:pt-16 md:pl-[240px] sm:pb-12">
        <p className="text-xl text-white font-medium">No active sales found for your wallet</p>
        <p className="text-sm text-gray-300 mt-3">
          Wallet: {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
        </p>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen bg-slate-900 px-6 sm:px-8 lg:px-12 py-16 sm:py-24 md:pl-[240px]">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 sm:mb-14 gap-6">
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
              Your Active Sales
            </h2>
            <p className="text-base text-gray-300 mt-3">
              Showing sales active as of current IST time
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-gray-800/40 text-cyan-300 px-4 py-2 rounded-lg text-sm font-medium border border-gray-700/40 shadow-sm">
              {currentTime.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })}
            </div>
            <div className="bg-gray-800/40 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium border border-gray-700/40 shadow-sm">
              Connected: {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
            </div>
          </div>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {sales.map((sale) => (
            <div 
              key={sale.id} 
              className="group bg-gray-800/30 rounded-2xl border border-gray-700/40 p-6 hover:border-cyan-500/50 transition-all duration-500 hover:shadow-xl hover:scale-[1.02]"
            >
              <div className="flex justify-between items-start mb-5">
                <h3 className="text-2xl font-bold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-cyan-300 group-hover:bg-clip-text transition-all duration-300">
                  {sale.tokenName} <span className="text-gray-300">({sale.tokenSymbol})</span>
                </h3>
                <span className="bg-green-600/30 text-green-300 text-xs px-3 py-1 rounded-full border border-green-500/40 font-medium">
                  ACTIVE
                </span>
              </div>
              
              <div className="space-y-4 text-base">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-300 group-hover:text-white">Token Address:</span>
                  <span className="font-mono text-sm text-gray-200">
                    {sale.tokenAddress ? sale.tokenAddress.substring(0, 12) + '...' : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-300 group-hover:text-white">Listing Rate:</span>
                  <span className="text-gray-200">{sale.listingRate || sale.lpLaunchPrice || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-300 group-hover:text-white">Soft Cap:</span>
                  <span className="text-gray-200">{sale.softCap || sale.softcap || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-300 group-hover:text-white">Hard Cap:</span>
                  <span className="text-gray-200">{sale.hardCap || sale.hardcap || 'N/A'}</span>
                </div>
                <div className="pt-4 mt-4 border-t border-gray-700/40">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-300 group-hover:text-white">Start:</span>
                    <span className="text-sm text-gray-200">{formatDate(sale.startTime || sale.publicStartDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-300 group-hover:text-white">End:</span>
                    <span className="text-sm text-gray-200">{formatDate(sale.endTime || sale.publicEndDate)}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 pt-5 border-t border-gray-700/40 flex justify-between items-center">
                <button 
                  onClick={() => handleViewDetails(sale.id)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold text-base transition-colors duration-300"
                >
                  View Details →
                </button>
                <span className="text-xs text-gray-300">ID: {sale.id.substring(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SaleList;