"use client";

import React, { useEffect, useState } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { useParams, useRouter } from 'next/navigation';
import { BrowserProvider } from 'ethers';
import Purchase from './Purchase';

// Define interfaces for type safety
interface Whitelist {
  whitelistAddresses: string[];
  whitelistSaleLimit: string;
  whitelistSalePrice: string;
  whitelistMinBuy: string;
  whitelistMaxBuy: string;
}

interface Sale {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  totalSupply: string;
  paymentToken: string;
  presaleRate: string;
  listingRate: string;
  softCap: string;
  hardCap: string;
  preSaleLimit: string;
  startTime: string;
  endTime: string;
  minBuy: string;
  maxBuy: string;
  description: string;
  hasWhitelist: boolean;
  whitelist: Whitelist | null;
  createdAt: string;
  createdBy: string;
}

interface DetailItemProps {
  label: string;
  value: string;
  isAddress?: boolean;
}

const SaleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [showPurchaseTab, setShowPurchaseTab] = useState<boolean>(false);

  useEffect(() => {
    const fetchSaleDetails = async () => {
      try {
        setLoading(true);
        if (window.ethereum) {
          const provider = new BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_accounts", []);
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            // Fetch sale data (search all users)
            let found = false;
            const allSalesRef = ref(database, 'sales');
            const allSalesSnap = await get(allSalesRef);
            if (allSalesSnap.exists()) {
              const salesData = allSalesSnap.val();
              for (const user in salesData) {
                if (salesData[user].launches && salesData[user].launches[id]) {
                  const saleData = salesData[user].launches[id];
                  // Whitelist logic
                  if (saleData.hasWhitelist && saleData.whitelist && Array.isArray(saleData.whitelist.whitelistAddresses)) {
                    const isCreator = user && user.toLowerCase() === accounts[0].toLowerCase();
                    const isWhitelisted = saleData.whitelist.whitelistAddresses
                      .map((addr: string) => addr.toLowerCase())
                      .includes(accounts[0].toLowerCase());
                    if (!isCreator && !isWhitelisted) {
                      setError('You are not whitelisted for this sale.');
                      router.replace('/sale');
                      return;
                    }
                  }
                  const mappedSale: Sale = {
                    id,
                    tokenName: saleData.tokenName || 'N/A',
                    tokenSymbol: saleData.tokenSymbol || 'N/A',
                    tokenAddress: saleData.tokenAddress || id,
                    totalSupply: saleData.totalSupply || '',
                    paymentToken: saleData.paymentCurrency,
                    presaleRate: saleData.salePrice,
                    listingRate: saleData.lpLaunchPrice,
                    softCap: saleData.softcap,
                    hardCap: saleData.hardcap,
                    preSaleLimit: saleData.preSaleLimit || '',
                    startTime: saleData.publicStartDate,
                    endTime: saleData.publicEndDate,
                    minBuy: saleData.minBuy,
                    maxBuy: saleData.maxBuy,
                    description: saleData.saleDescription,
                    hasWhitelist: saleData.hasWhitelist,
                    whitelist: saleData.whitelist || null,
                    createdAt: saleData.createdAt,
                    createdBy: user
                  };
                  setSale(mappedSale);
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              setError('Sale not found');
              router.replace('/sales');
            }
          } else {
            setError('Wallet not connected');
            router.replace('/sales');
          }
        } else {
          setError('Wallet not detected');
        }
      } catch (err: unknown) {
        console.error('Error fetching sale:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sale details');
      } finally {
        setLoading(false);
      }
    };

    fetchSaleDetails();
  }, [id, router]);

  if (loading) {
    return <div className="text-center py-8">Loading sale details...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => router.push('/sales')}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Back to Sales
        </button>
      </div>
    );
  }

  if (!sale) {
    return null;
  }

  return ( 
    <div className="container bg-gray-800 mx-auto px-4 py-8 max-w-3xl ">
      <button
        onClick={() => router.push('/sales')}
        className="mb-6 text-blue-600 hover:text-blue-800"
      >
        ← Back to All Sales
      </button>
      {showPurchaseTab && (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-40 flex items-center justify-center z-50">
          <div className=" rounded-lg shadow-lg p-8 max-w-md w-full relative bg-slate-900">
            <button
              className="absolute top-2 right-2 text-red-500 hover:text-black"
              onClick={() => setShowPurchaseTab(false)}
            >
              ✕
            </button>
            <div className="mb-4 ">
              <span className="block text-xs font-semibold text-gray-500">Sale ID:</span>
              <span className="block font-mono text-base text-gray-500">{sale?.id}</span>
              <span className="block mt-2 text-xs font-semibold text-gray-500">
                {sale?.hasWhitelist && sale?.whitelist
                  ? `Whitelist Sale Limit: ${sale.whitelist.whitelistSaleLimit}`
                  : `Sale Limit: ${sale?.preSaleLimit || "N/A"}`}
              </span>
              {sale?.hasWhitelist && sale?.whitelist && (
                <span className="block mt-2 text-xs font-semibold text-gray-500">
                  Whitelist Sale Price: {sale.whitelist.whitelistSalePrice} {sale.paymentToken}/{sale.whitelist.whitelistMinBuy} token
                </span>
              )}
            </div>
            <Purchase />
          </div>
        </div>
      )}
      <div className="bg-slate-900 rounded-lg shadow-md p-6 border-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">
              {sale.tokenName} <span className="text-gray-500">({sale.tokenSymbol})</span>
            </h2>
            <div className="mt-2">
              {sale.hasWhitelist && sale.whitelist ? (
                <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">White-List added</span>
              ) : (
                <span className="inline-block bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-semibold">White-List not added</span>
              )}
            </div>
          </div>
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            {sale.paymentToken}
          </span>
        </div>
        {sale.description && (
          <div className="mb-6 p-4 bg-slate-700 rounded-lg">
            <h3 className="font-semibold mb-2">Description</h3>
            <p>{sale.description}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Token Details</h3>
            {sale.tokenAddress && (
              <DetailItem label="Token Address" value={sale.tokenAddress} isAddress />
            )}
            <DetailItem label="Token Name" value={sale.tokenName} />
            <DetailItem label="Token Symbol" value={sale.tokenSymbol} />
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Sale Parameters</h3>
            {!sale.hasWhitelist && (
              <DetailItem label="Presale Rate" value={`${sale.presaleRate} ${sale.paymentToken}/${sale.minBuy} token`} />
            )}
            <DetailItem label="Listing Rate" value={`${sale.listingRate} ${sale.paymentToken}/token`} />
            <DetailItem label="Soft Cap" value={`${sale.softCap} ${sale.paymentToken}`} />
            <DetailItem label="Hard Cap" value={`${sale.hardCap} ${sale.paymentToken}`} />
            {sale.preSaleLimit && (
              <DetailItem label="Pre-Sale Limit" value={`${sale.preSaleLimit} ${sale.paymentToken}`} />
            )}
          </div>
        </div>
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Timing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailItem label="Start Time" value={sale.startTime || sale.publicStartDate} />
            <DetailItem label="End Time" value={sale.endTime || sale.publicEndDate} />
          </div>
        </div>
        <div className="mt-8 space-y-4">
          {!sale.hasWhitelist && (
            <>
              <h3 className="text-lg font-semibold border-b pb-2">Investment Limits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem label="Minimum Buy" value={`${sale.minBuy} ${sale.paymentToken}`} />
                <DetailItem label="Maximum Buy" value={`${sale.maxBuy} ${sale.paymentToken}`} />
              </div>
            </>
          )}
        </div>
        {sale.hasWhitelist && sale.whitelist && (
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Whitelist</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailItem label="Whitelist Sale Limit" value={`${sale.whitelist.whitelistSaleLimit} token`} />
              <DetailItem label="Whitelist Sale Price" value={`${sale.whitelist.whitelistSalePrice} ${sale.paymentToken}/${sale.whitelist.whitelistMinBuy} token`} />
              <DetailItem label="Whitelist Minimum Buy" value={`${sale.whitelist.whitelistMinBuy} token`} />
              <DetailItem label="Whitelist Maximum Buy" value={`${sale.whitelist.whitelistMaxBuy} token`} />
            </div>
            <div className="mt-4">
              <span className="font-medium">Whitelisted Addresses:</span>
              <ul className="list-disc pl-5 mt-1">
                {sale.whitelist.whitelistAddresses.map((addr: string, i: number) => (
                  <li key={i} className="break-all text-sm">{addr}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="mt-8 text-sm text-gray-500">
          <p>Created at: {new Date(sale.createdAt).toLocaleString()}</p>
          <p>Created by: <span className="font-mono">{sale.createdBy}</span></p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowPurchaseTab(true)}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-semibold"
          >
            Purchase
          </button>
        </div>
      </div>
    </div>
  );
};

const DetailItem: React.FC<DetailItemProps> = ({ label, value, isAddress = false }) => (
  <div className="flex justify-between">
    <span className="font-medium text-gray-600">{label}:</span>
    {isAddress ? (
      <span className="font-mono text-sm break-all max-w-[180px] md:max-w-none">
       izational
        {value.substring(0, 6)}...{value.substring(value.length - 4)}
      </span>
    ) : (
      <span>{value}</span>
    )}
  </div>
);

export default SaleDetails;