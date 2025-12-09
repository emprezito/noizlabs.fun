import { supabase } from "@/integrations/supabase/client";

interface UploadResult {
  success: boolean;
  url?: string;
  hash?: string;
  error?: string;
}

interface TokenMetadataResult extends UploadResult {
  audioUrl?: string;
  imageUrl?: string;
}

/**
 * Upload a file to IPFS via platform edge function
 */
export async function uploadFileToIPFS(file: File, fileName: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);

    const { data, error } = await supabase.functions.invoke('upload-to-ipfs', {
      body: formData,
    });

    if (error) {
      console.error('IPFS upload error:', error);
      return { success: false, error: error.message };
    }

    return data as UploadResult;
  } catch (error: any) {
    console.error('IPFS upload error:', error);
    return { success: false, error: error.message || 'Failed to upload file' };
  }
}

/**
 * Upload JSON metadata to IPFS via platform edge function
 */
export async function uploadMetadataToIPFS(
  metadata: Record<string, any>,
  name: string
): Promise<UploadResult> {
  try {
    const { data, error } = await supabase.functions.invoke('upload-metadata-to-ipfs', {
      body: { metadata, name },
    });

    if (error) {
      console.error('Metadata upload error:', error);
      return { success: false, error: error.message };
    }

    return data as UploadResult;
  } catch (error: any) {
    console.error('Metadata upload error:', error);
    return { success: false, error: error.message || 'Failed to upload metadata' };
  }
}

/**
 * Upload audio, optional image, and create Metaplex-compliant metadata
 * @param audioFile - File object for audio, or null if using preloaded URL
 * @param imageFile - Optional image file
 * @param tokenData - Token name, symbol, description
 * @param preloadedAudioUrl - Optional pre-existing audio URL (e.g., from Discover page)
 */
export async function uploadTokenMetadata(
  audioFile: File | null,
  imageFile: File | null,
  tokenData: {
    name: string;
    symbol: string;
    description: string;
  },
  preloadedAudioUrl?: string | null
): Promise<TokenMetadataResult> {
  try {
    let audioUrl: string;
    let audioType = "audio/mpeg";

    // If we have an audio file, upload it; otherwise use the preloaded URL
    if (audioFile) {
      const audioResult = await uploadFileToIPFS(audioFile, `${tokenData.symbol}-audio`);
      if (!audioResult.success) {
        return { success: false, error: audioResult.error || 'Failed to upload audio' };
      }
      audioUrl = audioResult.url!;
      audioType = audioFile.type || "audio/mpeg";
    } else if (preloadedAudioUrl) {
      // Use the preloaded audio URL directly (already on IPFS from Discover upload)
      audioUrl = preloadedAudioUrl;
    } else {
      return { success: false, error: 'No audio file or URL provided' };
    }

    // Upload image file if provided
    let imageUrl: string | undefined;
    if (imageFile) {
      const imageResult = await uploadFileToIPFS(imageFile, `${tokenData.symbol}-image`);
      if (imageResult.success) {
        imageUrl = imageResult.url;
      }
    }

    // Create Metaplex-compliant metadata
    const metadata = {
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: tokenData.description,
      image: imageUrl || audioUrl, // Use audio as fallback for image
      animation_url: audioUrl, // Audio file
      external_url: `https://noizlabs.app/tokens`,
      attributes: [
        {
          trait_type: "Audio Type",
          value: "Audio Token"
        },
        {
          trait_type: "Platform",
          value: "NoizLabs"
        }
      ],
      properties: {
        files: [
          {
            uri: audioUrl,
            type: audioType
          },
          ...(imageUrl ? [{
            uri: imageUrl,
            type: imageFile?.type || "image/png"
          }] : [])
        ],
        category: "audio"
      }
    };

    // Upload metadata
    const metadataResult = await uploadMetadataToIPFS(metadata, tokenData.name);
    if (!metadataResult.success) {
      return { success: false, error: metadataResult.error || 'Failed to upload metadata' };
    }

    return {
      success: true,
      url: metadataResult.url,
      hash: metadataResult.hash,
      audioUrl,
      imageUrl
    };
  } catch (error: any) {
    console.error('Token metadata upload error:', error);
    return { success: false, error: error.message || 'Failed to upload token metadata' };
  }
}