const Parser = require('rss-parser');
const parser = new Parser();

async function fetchShelf(userId, shelf) {
    const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}`;
    try {
        const feed = await parser.parseURL(url);
        return feed.items.map(item => {
            // Extract data from description using regex
            const desc = item.content || '';
            
            const avgRatingMatch = desc.match(/average rating:\s*([\d.]+)/i);
            const userRatingMatch = desc.match(/rating:\s*(\d+)/i); // Simplified for "rating: 5"
            const dateAddedMatch = desc.match(/date added:\s*([\w\s,]+)/i);
            const dateReadMatch = desc.match(/date read:\s*([\w\s,]+)/i);
            const authorMatch = desc.match(/author:\s*([\w\s,.-]+)/i);

            const average_rating = avgRatingMatch ? parseFloat(avgRatingMatch[1]) : null;
            const user_rating = userRatingMatch ? parseFloat(userRatingMatch[1]) : null;
            
            const formatDate = (dateStr) => {
                if (!dateStr) return null;
                const date = new Date(dateStr.trim());
                return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
            };

            const book = {
                title: item.title,
                author: authorMatch ? authorMatch[1].trim() : 'Unknown Author',
                average_rating: average_rating,
                user_rating: user_rating,
                cover_image: item.enclosure ? item.enclosure.url : (desc.match(/src="([^"]+)"/) ? desc.match(/src="([^"]+)"/)[1] : null),
                goodreads_url: item.link,
                reading_status: shelf,
                date_added: formatDate(dateAddedMatch ? dateAddedMatch[1] : null),
                date_read: formatDate(dateReadMatch ? dateReadMatch[1] : null),
                highlight: average_rating >= 4.5,
                tags: shelf === 'read' ? ['fantasy', 'sci-fi'] : [],
                display_priority: user_rating >= 4 ? 'high' : (user_rating ? 'medium' : 'low')
            };

            // Fix cover image resolution (remove thumbnail suffixes like ._SY75_)
            if (book.cover_image) {
                book.cover_image = book.cover_image.replace(/\._S[YX]\d+_/, '');
                book.cover_image = book.cover_image.replace(/(\d+)(m|s)\//, '$1l/');
            }

            return book;
        });
    } catch (e) {
        console.error(`Error fetching shelf ${shelf}:`, e);
        return [];
    }
}

async function getAllBooks(userId) {
    const shelves = ['read', 'currently-reading', 'to-read'];
    const results = await Promise.all(shelves.map(shelf => fetchShelf(userId, shelf)));
    return results.flat();
}

module.exports = { getAllBooks };
