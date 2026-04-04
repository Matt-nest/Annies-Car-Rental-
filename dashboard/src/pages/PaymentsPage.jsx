import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Search, DollarSign, Download, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal State
  const [refundData, setRefundData] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAllPayments({ limit: 100 });
      setPayments(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openRefundModal = (payment) => {
    // Calculate how much has already been refunded
    const childRefunds = payments.filter(p => 
      p.payment_type === 'refund' && 
      p.booking_id === payment.booking_id && 
      p.notes?.includes(`Refund for payment ${payment.id}`)
    );
    const totalRefunded = childRefunds.reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
    const maxRefund = payment.amount - totalRefunded;

    if (maxRefund <= 0) {
      alert('This payment has already been fully refunded.');
      return;
    }

    setRefundData({ ...payment, maxRefund });
    setRefundAmount(maxRefund.toString());
    setRefundReason('requested_by_customer');
    setRefundError('');
  };

  const closeRefundModal = () => {
    setRefundData(null);
    setRefundAmount('');
    setRefundError('');
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    setRefundError('');
    
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0 || amt > refundData.maxRefund) {
      setRefundError(`Amount must be between $0.01 and $${refundData.maxRefund.toFixed(2)}`);
      return;
    }

    setRefunding(true);
    try {
      await api.issueRefund(refundData.id, { 
        amount: amt, 
        reason: refundReason 
      });
      closeRefundModal();
      await loadData();
    } catch (err) {
      setRefundError(err.message || 'Refund processing failed.');
    } finally {
      setRefunding(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Payments Ledger</h1>
          <p className="text-sm text-stone-500 mt-1">Review all transactions and manage refunds.</p>
        </div>
        <button className="btn-secondary" onClick={loadData}>
          <RefreshCw size={16} /> Sync
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Booking</th>
                  <th className="px-6 py-3 font-semibold">Customer</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Method</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payments.map(payment => {
                   const isStripe = payment.method === 'stripe' && payment.reference_id?.startsWith('pi_');
                   const isRefund = payment.payment_type === 'refund';
                   const isPositiveStr = isRefund ? 'text-red-600' : 'text-green-600';
                   const displayAmount = isRefund 
                     ? `-$${Math.abs(payment.amount).toFixed(2)}` 
                     : `$${parseFloat(payment.amount).toFixed(2)}`;

                   return (
                     <tr key={payment.id} className="hover:bg-stone-50/50 transition-colors">
                       <td className="px-6 py-4 text-stone-500 font-mono text-xs">
                         {format(new Date(payment.created_at), 'MM/dd/yy HH:mm')}
                       </td>
                       <td className="px-6 py-4">
                         <Link to={`/bookings/${payment.booking_id}`} className="font-mono font-medium text-blue-600 hover:text-blue-800 transition-colors">
                           {payment.bookings?.booking_code || payment.booking_id.substring(0, 8)}
                         </Link>
                       </td>
                       <td className="px-6 py-4 text-stone-900 font-medium">
                         {payment.bookings?.customers 
                           ? `${payment.bookings.customers.first_name} ${payment.bookings.customers.last_name}` 
                           : 'Unknown'}
                       </td>
                       <td className="px-6 py-4">
                         <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                           isRefund ? 'bg-red-50 text-red-700' :
                           payment.payment_type === 'deposit' ? 'bg-purple-50 text-purple-700' :
                           'bg-blue-50 text-blue-700'
                         }`}>
                           {payment.payment_type}
                         </span>
                       </td>
                       <td className="px-6 py-4">
                         <div className="flex items-center gap-1.5 text-stone-600 capitalize">
                           {payment.method === 'stripe' ? <CreditCard size={14} className="text-blue-500"/> : <DollarSign size={14} className="text-green-500"/>}
                           {payment.method}
                         </div>
                       </td>
                       <td className={`px-6 py-4 text-right font-medium font-mono ${isPositiveStr}`}>
                         {displayAmount}
                       </td>
                       <td className="px-6 py-4 text-right">
                         {!isRefund && isStripe && payment.amount > 0 && (
                           <button 
                             onClick={() => openRefundModal(payment)}
                             className="text-amber-600 hover:text-amber-800 text-xs font-medium border border-amber-200 hover:border-amber-300 bg-amber-50 px-3 py-1 rounded transition-colors"
                           >
                             Refund
                           </button>
                         )}
                       </td>
                     </tr>
                   )
                })}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-stone-400">
                      No payments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleRefundSubmit}>
              <div className="px-6 py-5 border-b border-stone-100 bg-stone-50">
                <h3 className="text-lg font-semibold text-stone-900">Issue Stripe Refund</h3>
                <p className="text-sm text-stone-500 mt-1">
                  Booking: <span className="font-mono text-stone-700">{refundData.bookings?.booking_code}</span>
                </p>
              </div>

              <div className="p-6 space-y-5">
                {refundError && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p>{refundError}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1.5 block">Refund Amount ($)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      max={refundData.maxRefund}
                      required
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <p className="text-xs text-stone-400 front-medium mt-1.5">
                    Max available to refund: <span className="text-stone-700 font-mono">${refundData.maxRefund.toFixed(2)}</span>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1.5 block">Reason</label>
                  <select 
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                  >
                    <option value="requested_by_customer">Requested by Customer</option>
                    <option value="duplicate">Duplicate Charge</option>
                    <option value="fraudulent">Fraudulent</option>
                  </select>
                </div>

                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-800 text-xs">
                  <span className="font-semibold block mb-1">Warning</span>
                  This will immediately reverse the funds directly on the customer's card via Stripe. This action cannot be undone.
                </div>
              </div>

              <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
                <button type="button" onClick={closeRefundModal} className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={refunding}
                  className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                >
                  {refunding && <RefreshCw size={14} className="animate-spin" />}
                  Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
