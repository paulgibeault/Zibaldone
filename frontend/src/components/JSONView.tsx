import React from 'react';
import './JSONView.css';
import { CopyButton } from './CopyButton';

interface JSONViewProps {
    data: string | object | null | undefined;
}

export const JSONView: React.FC<JSONViewProps> = ({ data }) => {
    const formatJSON = (jsonInput: string | object | null | undefined): string => {
        if (!jsonInput) return '';

        let jsonStr: string;
        if (typeof jsonInput !== 'string') {
            jsonStr = JSON.stringify(jsonInput, null, 2);
        } else {
            try {
                const parsed = JSON.parse(jsonInput);
                jsonStr = JSON.stringify(parsed, null, 2);
            } catch (e) {
                jsonStr = jsonInput;
            }
        }

        // Simple regex-based syntax highlighting
        return jsonStr.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match: string) => {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
    };

    return (
        <CopyButton text={typeof data === 'string' ? data : JSON.stringify(data, null, 2)} className="json-view-wrapper">
            <pre
                className="json-view"
                dangerouslySetInnerHTML={{ __html: formatJSON(data) }}
            />
        </CopyButton>
    );
};
