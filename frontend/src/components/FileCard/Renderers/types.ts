import { ContentItem } from '../../../api';

export interface RendererProps {
    item: ContentItem;
    url: string;
    metadata: Record<string, any>;
    textContent: string | null;
    isLoadingContent: boolean;
}
