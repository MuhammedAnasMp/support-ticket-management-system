import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (num: number) => void;
  itemsPerPageOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [5, 10, 20, 50]
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (validPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(validPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-surface-container-low border-t border-outline-variant text-xs">
      <div className="flex items-center gap-3 text-on-surface-variant">
        <span>
          Showing <strong className="text-on-surface font-semibold">{startItem}</strong> to <strong className="text-on-surface font-semibold">{endItem}</strong> of <strong className="text-on-surface font-semibold">{totalItems}</strong> entries
        </span>
        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[11px]">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="bg-surface-container border border-outline text-on-surface rounded px-2 py-0.5 text-xs focus:outline-none cursor-pointer"
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={validPage === 1}
          className="p-1.5 rounded border border-outline text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="First Page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(validPage - 1)}
          disabled={validPage === 1}
          className="p-1.5 rounded border border-outline text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1"
          title="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Prev</span>
        </button>

        <span className="px-3 py-1 font-medium text-on-surface text-[11px]">
          Page {validPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(validPage + 1)}
          disabled={validPage >= totalPages}
          className="p-1.5 rounded border border-outline text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1"
          title="Next Page"
        >
          <span className="hidden sm:inline text-[11px]">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={validPage >= totalPages}
          className="p-1.5 rounded border border-outline text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Last Page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
