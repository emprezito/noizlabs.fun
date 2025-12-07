// Pinata IPFS upload service
const PINATA_API_URL = "https://api.pinata.cloud";

interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface UploadResult {
  success: boolean;
  ipfsHash?: string;
  url?: string;
  error?: string;
}

// Upload file to Pinata IPFS
export async function uploadToPinata(
  file: File,
  pinataApiKey: string,
  pinataSecretKey: string
): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: file.type,
        uploadedAt: new Date().toISOString(),
      },
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append("pinataOptions", options);

    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
    }

    const data: PinataUploadResponse = await response.json();
    
    return {
      success: true,
      ipfsHash: data.IpfsHash,
      url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    };
  } catch (error: any) {
    console.error("Pinata upload error:", error);
    return {
      success: false,
      error: error.message || "Failed to upload to IPFS",
    };
  }
}

// Upload JSON metadata to Pinata
export async function uploadMetadataToPinata(
  metadata: Record<string, any>,
  name: string,
  pinataApiKey: string,
  pinataSecretKey: string
): Promise<UploadResult> {
  try {
    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretKey,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name,
        },
        pinataOptions: {
          cidVersion: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
    }

    const data: PinataUploadResponse = await response.json();
    
    return {
      success: true,
      ipfsHash: data.IpfsHash,
      url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    };
  } catch (error: any) {
    console.error("Pinata metadata upload error:", error);
    return {
      success: false,
      error: error.message || "Failed to upload metadata to IPFS",
    };
  }
}

// Create and upload complete token metadata
export async function uploadTokenMetadata(
  audioFile: File,
  imageFile: File | null,
  tokenData: {
    name: string;
    symbol: string;
    description: string;
  },
  pinataApiKey: string,
  pinataSecretKey: string
): Promise<UploadResult> {
  try {
    // Upload audio file
    const audioResult = await uploadToPinata(audioFile, pinataApiKey, pinataSecretKey);
    if (!audioResult.success) {
      throw new Error(`Audio upload failed: ${audioResult.error}`);
    }

    // Upload image if provided
    let imageUrl: string | undefined;
    if (imageFile) {
      const imageResult = await uploadToPinata(imageFile, pinataApiKey, pinataSecretKey);
      if (!imageResult.success) {
        throw new Error(`Image upload failed: ${imageResult.error}`);
      }
      imageUrl = imageResult.url;
    }

    // Create metadata JSON following Metaplex standard
    const metadata = {
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: tokenData.description,
      image: imageUrl || "",
      animation_url: audioResult.url, // Audio file
      external_url: "https://noizlabs.io",
      attributes: [
        {
          trait_type: "Audio Type",
          value: audioFile.type,
        },
        {
          trait_type: "File Size",
          value: `${(audioFile.size / 1024).toFixed(2)} KB`,
        },
      ],
      properties: {
        files: [
          {
            uri: audioResult.url,
            type: audioFile.type,
          },
          ...(imageUrl ? [{ uri: imageUrl, type: imageFile?.type || "image/png" }] : []),
        ],
        category: "audio",
      },
    };

    // Upload metadata
    const metadataResult = await uploadMetadataToPinata(
      metadata,
      `${tokenData.symbol}_metadata`,
      pinataApiKey,
      pinataSecretKey
    );

    if (!metadataResult.success) {
      throw new Error(`Metadata upload failed: ${metadataResult.error}`);
    }

    return {
      success: true,
      ipfsHash: metadataResult.ipfsHash,
      url: metadataResult.url,
    };
  } catch (error: any) {
    console.error("Token metadata upload error:", error);
    return {
      success: false,
      error: error.message || "Failed to create token metadata",
    };
  }
}
