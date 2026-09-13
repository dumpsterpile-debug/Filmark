import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import Pagination from "@/components/Pagination";

beforeAll(async () => {
  // 固定语言，让断言使用独立于实现的已知字面量（来自 en.json）
  await i18n.changeLanguage("en");
});

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}

function renderPagination(overrides: Partial<PaginationProps> = {}) {
  const onPage = vi.fn();
  const onPageSize = vi.fn();
  const props: PaginationProps = {
    total: 100,
    page: 1,
    pageSize: 20,
    onPage,
    onPageSize,
    ...overrides,
  };
  render(<Pagination {...props} />);
  return { onPage, onPageSize };
}

describe("Pagination", () => {
  it("renders the visible item range for the current page", () => {
    renderPagination({ total: 100, page: 2, pageSize: 20 });

    expect(screen.getByText("21–40 of 100")).toBeInTheDocument();
  });

  it("disables Previous on the first page", () => {
    renderPagination({ total: 100, page: 1, pageSize: 20 });

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("disables Next on the last page", () => {
    renderPagination({ total: 100, page: 5, pageSize: 20 });

    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("reports the clicked page number through onPage", async () => {
    const user = userEvent.setup();
    const { onPage } = renderPagination({ total: 100, page: 2, pageSize: 20 });

    await user.click(screen.getByRole("button", { name: "4" }));

    expect(onPage).toHaveBeenCalledWith(4);
  });

  it("collapses a long page list into a window with ellipses", () => {
    // 1000 条 / 每页 25 = 40 页；第 20 页时窗口应为 1 … 19 20 21 … 40
    renderPagination({ total: 1000, page: 20, pageSize: 25 });

    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "40" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "30" })).not.toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("reports the chosen page size through onPageSize", async () => {
    const user = userEvent.setup();
    const { onPageSize } = renderPagination({ total: 100, page: 1, pageSize: 20 });

    await user.click(screen.getByRole("button", { name: "50" }));

    expect(onPageSize).toHaveBeenCalledWith(50);
  });
});
