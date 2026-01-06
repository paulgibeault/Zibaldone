import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Colors
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import './MarkdownPreview.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Colors
);

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark', // We can sync this with app theme later
    securityLevel: 'loose',
});

interface MarkdownPreviewProps {
    content: string;
}

const MermaidChart = ({ code }: { code: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const renderMermaid = async () => {
            if (!containerRef.current) return;
            try {
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(id, code);
                setSvg(svg);
                setError(null);
            } catch (err) {
                console.error("Mermaid error:", err);
                setError("Failed to render diagram");
            }
        };

        renderMermaid();
    }, [code]);

    if (error) return <div className="mermaid-error">{error}</div>;
    return <div ref={containerRef} className="mermaid-rendered" dangerouslySetInnerHTML={{ __html: svg }} />;
};

const ChartJSPreview = ({ code }: { code: string }) => {
    try {
        const config = JSON.parse(code);
        const { type, data, options } = config;

        switch (type?.toLowerCase()) {
            case 'line': return <Line data={data} options={options} />;
            case 'bar': return <Bar data={data} options={options} />;
            case 'pie': return <Pie data={data} options={options} />;
            case 'doughnut': return <Doughnut data={data} options={options} />;
            default: return <div>Unsupported chart type: {type}</div>;
        }
    } catch (err) {
        return <div className="chart-error">Invalid chart configuration: {String(err)}</div>;
    }
};

export const MarkdownPreview = ({ content }: MarkdownPreviewProps) => {
    return (
        <div className="markdown-preview-container">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1] : '';

                        if (!inline && lang === 'mermaid') {
                            return <MermaidChart code={String(children).replace(/\n$/, '')} />;
                        }

                        if (!inline && lang === 'chartjs') {
                            return <ChartJSPreview code={String(children).replace(/\n$/, '')} />;
                        }

                        if (!inline && match) {
                            return (
                                <SyntaxHighlighter
                                    {...props}
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                >
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            );
                        }

                        return (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
