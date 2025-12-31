import { useEffect } from "react";

interface DynamicMetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

const OG_IMAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-image`;

export const useDynamicMetaTags = ({
  title,
  description,
  image,
  url,
  type = "website",
}: DynamicMetaTagsProps) => {
  useEffect(() => {
    // Store original values
    const originalTitle = document.title;
    const metaTags: { element: HTMLMetaElement; originalContent: string }[] = [];

    const updateMetaTag = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
      }
      
      if (element) {
        metaTags.push({ element, originalContent: element.content });
        element.content = content;
      }
    };

    // Update document title
    if (title) {
      document.title = `${title} | NoizLabs`;
    }

    // Update OG tags
    if (title) {
      updateMetaTag("og:title", title);
      updateMetaTag("twitter:title", title);
    }

    if (description) {
      updateMetaTag("og:description", description);
      updateMetaTag("twitter:description", description);
      updateMetaTag("description", description);
    }

    if (image) {
      updateMetaTag("og:image", image);
      updateMetaTag("twitter:image", image);
    }

    if (url) {
      updateMetaTag("og:url", url);
    }

    if (type) {
      updateMetaTag("og:type", type);
    }

    // Cleanup: restore original values
    return () => {
      document.title = originalTitle;
      metaTags.forEach(({ element, originalContent }) => {
        element.content = originalContent;
      });
    };
  }, [title, description, image, url, type]);
};

// Helper to generate OG image URL for a token
export const getTokenOgImageUrl = (mintAddress: string): string => {
  return `${OG_IMAGE_BASE}?mint=${mintAddress}`;
};

// Helper to generate OG image URL for an audio clip
export const getClipOgImageUrl = (clipId: string): string => {
  return `${OG_IMAGE_BASE}?clip=${clipId}`;
};

export default useDynamicMetaTags;
