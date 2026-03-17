"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-xs text-[var(--sg-shell-500)]">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <IconButton
          variant="outline"
          size="sm"
          icon={<ChevronLeft size={16} />}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        />
        <IconButton
          variant="outline"
          size="sm"
          icon={<ChevronRight size={16} />}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        />
      </div>
    </div>
  );
}
