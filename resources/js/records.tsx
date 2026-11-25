import { useEffect, useState } from 'react';
import { api, getErrorMessage } from './api';
import { NotePage } from './sidebar';

export function RecordPage({ title, detail, url }: { title: string; detail: string; url: string }) {
    const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ data: Array<Record<string, unknown>> }>(url)
            .then(({ data }) => setRows(data.data))
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load this list.')));
    }, [url]);

    return (
        <NotePage title={title} detail={detail}>
            {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
            <ul className="mt-5 divide-y divide-slate-100">
                {rows.map((row, index) => (
                    <li key={String(row.id ?? index)} className="py-3 text-sm text-slate-700">
                        {summarize(row)}
                    </li>
                ))}
                {rows.length === 0 && !error && <li className="py-3 text-sm text-slate-500">No records yet.</li>}
            </ul>
        </NotePage>
    );
}

function summarize(row: Record<string, unknown>): string {
    const name = row.name ?? row.action ?? row.module ?? row.type ?? row.receipt_number ?? row.number;
    const extra = row.email ?? row.status ?? row.total ?? row.expires_on ?? row.description;

    return [name, extra].filter((value) => value !== undefined && value !== null).map(String).join(' · ');
}

export function PendingPage({ title, detail }: { title: string; detail: string }) {
    return <NotePage title={title} detail={detail} />;
}
