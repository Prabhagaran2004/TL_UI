import { useState, useEffect } from 'react';
import { SiEthereum } from 'react-icons/si';
import { BsInfoCircle } from 'react-icons/bs';
import { getTokensByWallet } from '../firebase';

const sepoliaChainId = '0xaa36a7';

interface Token {
  address: string;
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  network: string;
}
 
const TokenList = () => {
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [isSepolia, setIsSepolia] = useState<boolean>(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length !== 0) {
        const account = accounts[0];
        setCurrentAccount(account);
        await fetchTokens(account);
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      setIsSepolia(chainId === sepoliaChainId);
    } catch (error) {
      console.error(error);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setCurrentAccount(accounts[0]);
      await fetchTokens(accounts[0]);

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      setIsSepolia(chainId === sepoliaChainId);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTokens = async (walletAddress: string) => {
    try {
      setLoading(true);
      const tokensData = await getTokensByWallet(walletAddress.toLowerCase());
      
      if (tokensData) {
        const tokensArray = Object.entries(tokensData).map(([address, token]) => ({
          address,
          ...(token as Omit<Token, 'address'>)
        }));
        setTokens(tokensArray);
      } else {
        setTokens([]);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkIfWalletIsConnected();

    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        setCurrentAccount(accounts[0] || '');
        if (accounts[0]) {
          fetchTokens(accounts[0]);
        } else {
          setTokens([]);
        }
      };

      const handleChainChanged = (chainId: string) => {
        setIsSepolia(chainId === sepoliaChainId);
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center mb-8">Your Created Tokens</h1>
        
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-xl shadow-md overflow-hidden p-6">
          <div className="flex items-center mb-6">
            <SiEthereum className="text-3xl mr-2 text-blue-400" />
            <h2 className="text-2xl font-semibold">Token Portfolio</h2>
          </div>

          {!currentAccount ? (
            <button
              onClick={connectWallet}
              className="relative group w-full font-bold text-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 px-6 py-2.5 rounded-xl text-white transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
            >
              <span className="relative z-10 flex items-center justify-center">
                  Connect Wallet
                </span>
            </button>
          ) : (
            <div className="mb-6 sm:mb-8">
              <p className="font-semibold text-lg text-slate-400 mb-1">Connected Wallet</p>
              <p className="text-sm break-words text-slate-300">{currentAccount}</p>
            </div>
          )}

          {currentAccount && !isSepolia && (
            <div className="mb-6 p-4 bg-yellow-900 rounded-lg">
              <div className="flex items-start">
                <BsInfoCircle className="text-yellow-300 mt-1 mr-2" />
                <div>
                  <p className="text-yellow-200">You're not on Sepolia network</p>
                  <p className="text-yellow-100 text-sm mt-1">(Token data will still show, but some features may not work)</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : tokens.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tokens.map((token, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition duration-200">
                    <h3 className="text-xl font-semibold mb-2">{token.tokenName} ({token.tokenSymbol})</h3>
                    <div className="space-y-1">
                      <p className="text-sm"><span className="text-gray-400">Supply:</span> {token.totalSupply}</p>
                      <p className="text-sm"><span className="text-gray-400">Network:</span> {token.network}</p>
                      <p className="text-sm break-all">
                        <span className="text-gray-400">Address:</span>{' '}
                        <a 
                          href={`https://sepolia.etherscan.io/address/${token.address}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {token.address}
                        </a>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : currentAccount ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No tokens found for this wallet address.</p>
              <p className="text-gray-500 text-sm mt-2">Create tokens using the Token Launch Platform</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TokenList;