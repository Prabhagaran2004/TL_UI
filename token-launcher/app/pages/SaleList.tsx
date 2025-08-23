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
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    return istTime;
  };

  // Helper function to parse date and convert to IST for comparison
  const parseToISTDate = (dateValue: string | number | undefined): Date | null => {
    if (!dateValue) return null;
    
    try {
      let date: Date;
      
      // If the value matches 'DD/MM/YYYY HH:mm AM/PM', parse it
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
          // Check if it's already in locale format (like "8/24/2004, 6:35:00 AM")
          const localePattern = /^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)$/;
          if (localePattern.test(dateValue)) {
            date = new Date(dateValue);
          } else {
            // Try parsing as regular date string
            date = new Date(dateValue);
            if (isNaN(date.getTime())) {
              // Try parsing as number if it's a numeric string
              const numericValue = Number(dateValue);
              if (!isNaN(numericValue)) {
                // Handle timestamp properly - check if it's in seconds or milliseconds
                if (numericValue < 1000000000000) {
                  // Timestamp in seconds, convert to milliseconds
                  date = new Date(numericValue * 1000);
                } else {
                  // Timestamp in milliseconds
                  date = new Date(numericValue);
                }
              }
            }
          }
        }
      } else if (typeof dateValue === 'number') {
        // Handle timestamp (both seconds and milliseconds)
        if (dateValue < 1000000000000) {
          // Timestamp in seconds, convert to milliseconds
          date = new Date(dateValue * 1000);
        } else {
          // Timestamp in milliseconds
          date = new Date(dateValue);
        }
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      // Additional validation: reject dates that are too old (before 2020) or too far in future (after 2030)
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
    
    // Format to IST
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
    const currentIST = new Date(); // Current time
    const startTime = parseToISTDate(sale.startTime || sale.publicStartDate);
    const endTime = parseToISTDate(sale.endTime || sale.publicEndDate);
    
    // If we can't parse dates, exclude the sale (safer approach)
    if (!startTime || !endTime) {
      console.warn(`Sale ${sale.id} has invalid dates:`, {
        startTime: sale.startTime || sale.publicStartDate,
        endTime: sale.endTime || sale.publicEndDate
      });
      return false;
    }
    
    // Debug logging
    console.log(`Sale ${sale.id} - Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}, Current: ${currentIST.toISOString()}`);
    
    // Check if current time is between start and end time
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
        // Fetch all sales for all users
        const allSalesRef = ref(database, 'sales');
        const allSalesSnap = await get(allSalesRef);
        let allSales: Sale[] = [];
        
        if (allSalesSnap.exists()) {
          const salesData: SalesData = allSalesSnap.val();
          // Flatten all launches from all users
          Object.entries(salesData).forEach(([user, launches]) => {
            if (launches && launches.launches) {
              Object.entries(launches.launches).forEach(([id, data]) => {
                allSales.push({
                  id,
                  ...data,
                  // Map the date fields to consistent names
                  startTime: data.startTime || data.publicStartDate,
                  endTime: data.endTime || data.publicEndDate,
                  createdBy: user // Ensure creator is attached to each sale
                });
              });
            }
          });
        }
        
        // Filter sales based on whitelist logic
        const whitelistFilteredSales = allSales.filter(sale => {
          if (!sale.hasWhitelist || !sale.whitelist) return true;
          if (!walletAddress) return false;
          // Show if wallet is in whitelist or is creator
          const isCreator = sale.createdBy && sale.createdBy.toLowerCase() === walletAddress.toLowerCase();
          const isWhitelisted = Array.isArray(sale.whitelist.whitelistAddresses) && 
            sale.whitelist.whitelistAddresses.map(addr => addr.toLowerCase()).includes(walletAddress.toLowerCase());
          return isCreator || isWhitelisted;
        });
        
        // Filter sales based on time (only show active sales based on IST)
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

  // Check if wallet is already connected
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

  // Update current time every second
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
      // Use Next.js client-side navigation
      window.location.href = `/sale/${saleId}`;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        Loading sales...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500">
        {error}
        {typeof window !== 'undefined' && !window.ethereum && (
          <div className="mt-2">
            <a 
              href="https://metamask.io/download.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline"
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
      <div className="text-center py-8">
        <button
          onClick={connectWallet}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Connect Wallet
        </button>
        <p className="mt-2 text-gray-600">Connect your wallet to view your sales</p>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-lg">No active sales found for your wallet</p>
        <p className="text-sm text-gray-500 mt-2">
          Wallet: {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
        </p>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen overflow-hidden bg-slate-900 px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Your Active Sales
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Showing sales active as of current IST time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-800/30 text-cyan-400 px-3 py-1 rounded-full text-sm border border-slate-700/50 backdrop-blur-sm">
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
            <div className="bg-slate-800/30 text-slate-300 px-3 py-1 rounded-full text-sm border border-slate-700/50 backdrop-blur-sm">
              Connected: {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
            </div>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sales.map((sale) => (
            <div 
              key={sale.id} 
              className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-slate-700/50 p-6 hover:border-slate-600/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl sm:text-2xl font-semibold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-white group-hover:to-slate-300 transition-all duration-300">
                  {sale.tokenName} <span className="text-slate-400">({sale.tokenSymbol})</span>
                </h3>
                <span className="bg-green-600/20 text-green-400 text-xs px-2 py-1 rounded border border-green-500/30">
                  ACTIVE
                </span>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-400 group-hover:text-slate-300">Token Address:</span>
                  <span className="font-mono text-xs text-slate-300">
                    {sale.tokenAddress ? sale.tokenAddress.substring(0, 12) + '...' : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-400 group-hover:text-slate-300">Listing Rate:</span>
                  <span className="text-slate-300">{sale.listingRate || sale.lpLaunchPrice || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-400 group-hover:text-slate-300">Soft Cap:</span>
                  <span className="text-slate-300">{sale.softCap || sale.softcap || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-400 group-hover:text-slate-300">Hard Cap:</span>
                  <span className="text-slate-300">{sale.hardCap || sale.hardcap || 'N/A'}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-700/50">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400 group-hover:text-slate-300">Start:</span>
                    <span className="text-xs text-slate-300">{formatDate(sale.startTime || sale.publicStartDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400 group-hover:text-slate-300">End:</span>
                    <span className="text-xs text-slate-300">{formatDate(sale.endTime || sale.publicEndDate)}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                <button 
                  onClick={() => handleViewDetails(sale.id)}
                  className="text-cyan-400 hover:text-cyan-300 font-medium text-sm transition-colors duration-300"
                >
                  View Details →
                </button>
                <span className="text-xs text-slate-400">ID: {sale.id.substring(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SaleList;