import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { showApiError } from './api-error';


// Global safety net: any mutation/query error without its own onError
// handler surfaces a toast instead of failing silently.
export const queryClientInstance = new QueryClient({
	queryCache: new QueryCache({
		onError: (error) => {
			// Only surface mutation failures globally; query errors are logged.
			console.error('[query]', error);
		},
	}),
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			// Mutations with their own onError are already handled.
			if (mutation.options.onError) return;
			showApiError(error);
		},
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
