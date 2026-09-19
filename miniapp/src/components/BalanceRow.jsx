import { formatMoneySigned, balanceColor } from '../utils/format';

export default function BalanceRow({ row }) {
  return (
    <div className="balance-row">
      <div>
        <div className="balance-name">{row.trainerName}</div>
        <div className="balance-detail">Проведено {row.completed} из {row.paid} оплаченных</div>
      </div>
      <div className={`balance-amount ${balanceColor(row.balance)}`}>
        {formatMoneySigned(row.balance)}
      </div>
    </div>
  );
}
