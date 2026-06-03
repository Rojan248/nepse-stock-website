import { useParams } from 'react-router-dom';
import { useSharedWatchlistData } from '../hooks/useSharedWatchlistData';
import SharedWatchlistView from '../components/SharedWatchlistView';

function SharedWatchlistPage() {
    const { slug } = useParams();
    return <SharedWatchlistView {...useSharedWatchlistData(slug)} />;
}

export default SharedWatchlistPage;
