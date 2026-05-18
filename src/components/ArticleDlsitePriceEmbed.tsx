import { DlsitePricePanel } from "@/components/DlsitePricePanel";
import { getDlsiteProductById } from "@/lib/dlsite-product-catalog";

type Props = {
  productId: string;
  affiliateHref?: string;
};

/** 記事本文（Markdown）から `data-dlsite-product-id` で埋め込む価格パネル */
export function ArticleDlsitePriceEmbed({ productId, affiliateHref }: Props) {
  const id = productId.trim();
  if (!id) return null;
  const product = getDlsiteProductById(id);
  if (!product) return null;
  return (
    <DlsitePricePanel
      product={product}
      affiliateHref={affiliateHref?.trim() || undefined}
    />
  );
}
