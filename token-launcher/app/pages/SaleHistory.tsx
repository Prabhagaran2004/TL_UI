import React, { useEffect, useState } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';

interface PurchaseHistoryItem {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  quantityPurchased?: number;
  amountPaid: string;
  saleId: string;
  saleOwner?: string;
  whitelistEnabled?: boolean;
  hasWhitelist?: boolean;
  softcap: string;
  hardcap: string;
  timestamp?: string;
}

export default function SaleHistory() {
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [wallet, setWallet] = useState<string>('');

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError('');
      try {
        if (window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length === 0) {
            setError('Please connect your wallet.');
            setLoading(false);
            return;
          }
          const walletAddress = accounts[0];
          setWallet(walletAddress);
          const historyRef = ref(database, `sales/${walletAddress}/history`);
          const snap = await get(historyRef);
          
          if (snap.exists()) {
            const data = snap.val();
            const arr: PurchaseHistoryItem[] = Object.keys(data).map((id) => ({
              id,
              ...data[id]
            }));
            
            // Fetch sale owners
            for (const item of arr) {
              const allSalesRef = ref(database, 'sales');
              const allSalesSnap = await get(allSalesRef);
              if (allSalesSnap.exists()) {
                const salesData = allSalesSnap.val();
                for (const user in salesData) {
                  if (salesData[user]?.launches?.[item.saleId]) {
                    item.saleOwner = user;
                    break;
                  }
                }
              }
            }
            
            // Sort by timestamp
            arr.sort((a, b) => {
              const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return dateB - dateA;
            });
            
            setHistory(arr);
          } else {
            setHistory([]);
          }
        } else {
          setError('No Ethereum wallet detected.');
        }
      } catch (err) {
        setError('Failed to fetch history.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchHistory();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Purchase History</h2>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : history.length === 0 ? (
        <div>No purchase history found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 border">Token Name</th>
                <th className="px-3 py-2 border">Symbol</th>
                <th className="px-3 py-2 border">Token Address</th>
                <th className="px-3 py-2 border">Quantity</th>
                <th className="px-3 py-2 border">Amount Paid</th>
                <th className="px-3 py-2 border">Sale ID</th>
                <th className="px-3 py-2 border">Sale Owner</th>
                <th className="px-3 py-2 border">Whitelist</th>
                <th className="px-3 py-2 border">Softcap</th>
                <th className="px-3 py-2 border">Hardcap</th>
                <th className="px-3 py-2 border">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2 border">{item.tokenName}</td>
                  <td className="px-3 py-2 border">{item.tokenSymbol}</td>
                  <td className="px-3 py-2 border font-mono text-xs break-all">{item.tokenAddress}</td>
                  <td className="px-3 py-2 border">{item.quantityPurchased ?? ''}</td>
                  <td className="px-3 py-2 border">{item.amountPaid}</td>
                  <td className="px-3 py-2 border font-mono text-xs break-all">{item.saleId}</td>
                  <td className="px-3 py-2 border font-mono text-xs break-all">{item.saleOwner || ''}</td>
                  <td className="px-3 py-2 border">
                    {item.whitelistEnabled || item.hasWhitelist ? 'Enabled' : 'Not-Enabled'}
                  </td>
                  <td className="px-3 py-2 border">{item.softcap}</td>
                  <td className="px-3 py-2 border">{item.hardcap}</td>
                  <td className="px-3 py-2 border">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}