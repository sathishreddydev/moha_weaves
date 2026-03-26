import { DelhiveryService } from "./delhiveryService";

export interface Address {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

export interface ValidatedAddress extends Address {
  isValid: boolean;
  isServiceable: boolean;
  originalAddress?: Address;
  suggestedAddress?: Address;
  requiresCustomerConfirmation?: boolean;
  validationErrors?: string[];
  serviceabilityDetails?: {
    prepaid: boolean;
    cod: boolean;
    city: string;
    state: string;
    country: string;
  };
}

export class AddressValidationService {
  private static delhiveryService = new DelhiveryService();

  /**
   * Validate and fix address automatically
   */
  static async validateAndFixAddress(address: Address): Promise<ValidatedAddress> {
    try {
      console.log(`🔍 Validating address: ${address.pincode}, ${address.city}`);
      
      // 1. Standardize address format
      const standardized = this.standardizeAddress(address);
      
      // 2. Validate pincode and check serviceability
      const serviceability = await this.validatePincode(standardized.pincode);
      
      // 3. Check if address is serviceable
      if (!serviceability.isServiceable) {
        console.log(`⚠️ Pincode ${standardized.pincode} not serviceable, finding nearest...`);
        
        // Find nearest serviceable area
        const nearestServiceable = await this.findNearestServiceableArea(standardized);
        
        return {
          ...standardized,
          isValid: true,
          isServiceable: false,
          originalAddress: address,
          suggestedAddress: nearestServiceable,
          requiresCustomerConfirmation: true,
          serviceabilityDetails: serviceability
        };
      }
      
      // 4. Validate address components
      const validationErrors = this.validateAddressComponents(standardized);
      
      return {
        ...standardized,
        isValid: validationErrors.length === 0,
        isServiceable: true,
        validationErrors,
        serviceabilityDetails: serviceability
      };
      
    } catch (error) {
      console.error(`❌ Address validation failed:`, error);
      
      return {
        ...address,
        isValid: false,
        isServiceable: false,
        validationErrors: [error instanceof Error ? error.message : "Validation failed"]
      };
    }
  }

  /**
   * Standardize address format
   */
  private static standardizeAddress(address: Address): Address {
    return {
      name: address.name.trim(),
      addressLine1: address.addressLine1.trim(),
      addressLine2: address.addressLine2?.trim() || "",
      city: address.city.trim(),
      state: address.state.trim(),
      pincode: address.pincode.trim(),
      phone: address.phone.trim()
    };
  }

  /**
   * Validate pincode and check serviceability
   */
  private static async validatePincode(pincode: string): Promise<{
    isServiceable: boolean;
    prepaid: boolean;
    cod: boolean;
    city: string;
    state: string;
    country: string;
  }> {
    try {
      // Check if pincode is valid format
      if (!/^\d{6}$/.test(pincode)) {
        throw new Error("Invalid pincode format");
      }

      // Check Delhivery serviceability
      const serviceability = await this.delhiveryService.checkPincodeServiceability(pincode);
      
      return {
        isServiceable: serviceability.isServiceable,
        prepaid: serviceability.prepaid,
        cod: serviceability.cod,
        city: serviceability.city,
        state: serviceability.state,
        country: serviceability.country
      };
      
    } catch (error) {
      console.error(`Pincode validation failed for ${pincode}:`, error);
      throw new Error(`Pincode validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Validate address components
   */
  private static validateAddressComponents(address: Address): string[] {
    const errors: string[] = [];

    // Name validation
    if (!address.name || address.name.length < 3) {
      errors.push("Name is required and must be at least 3 characters");
    }

    // Address line validation
    if (!address.addressLine1 || address.addressLine1.length < 10) {
      errors.push("Address line 1 is required and must be at least 10 characters");
    }

    // City validation
    if (!address.city || address.city.length < 3) {
      errors.push("City is required and must be at least 3 characters");
    }

    // State validation
    if (!address.state || address.state.length < 3) {
      errors.push("State is required and must be at least 3 characters");
    }

    // Phone validation
    if (!address.phone || !/^[6-9]\d{9}$/.test(address.phone)) {
      errors.push("Valid 10-digit phone number is required");
    }

    return errors;
  }

  /**
   * Find nearest serviceable area (simplified version)
   */
  private static async findNearestServiceableArea(address: Address): Promise<Address> {
    // For now, return a modified version with nearby serviceable pincode
    // In production, this would use Google Maps API or similar
    
    const nearbyPincodes = await this.getNearbyPincodes(address.pincode, 50);
    
    for (const nearbyPincode of nearbyPincodes) {
      try {
        const serviceability = await this.validatePincode(nearbyPincode);
        if (serviceability.isServiceable) {
          return {
            ...address,
            pincode: nearbyPincode,
            city: serviceability.city,
            state: serviceability.state
          };
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error("No serviceable area found within 50km radius");
  }

  /**
   * Get nearby pincodes (simplified version)
   */
  private static async getNearbyPincodes(pincode: string, radiusKm: number): Promise<string[]> {
    // For now, return some common serviceable pincodes
    // In production, this would use a proper geolocation service
    
    const serviceablePincodes = [
      "110001", "110002", "110003", "110004", "110005", // Delhi
      "400001", "400002", "400003", "400004", "400005", // Mumbai
      "560001", "560002", "560003", "560004", "560005", // Bangalore
      "600001", "600002", "600003", "600004", "600005", // Chennai
      "500001", "500002", "500003", "500004", "500005", // Hyderabad
      "700001", "700002", "700003", "700004", "700005", // Kolkata
      "380001", "380002", "380003", "380004", "380005", // Ahmedabad
      "411001", "411002", "411003", "411004", "411005", // Pune
    ];

    return serviceablePincodes;
  }

  /**
   * Batch validate multiple addresses
   */
  static async validateMultipleAddresses(addresses: Address[]): Promise<ValidatedAddress[]> {
    const results = await Promise.allSettled(
      addresses.map(address => this.validateAndFixAddress(address))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          ...addresses[index],
          isValid: false,
          isServiceable: false,
          validationErrors: [result.reason instanceof Error ? result.reason.message : "Validation failed"]
        };
      }
    });
  }

  /**
   * Check if address is within serviceable area
   */
  static async isAddressServiceable(address: Address): Promise<boolean> {
    try {
      const validated = await this.validateAndFixAddress(address);
      return validated.isServiceable;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get shipping estimate for address
   */
  static async getShippingEstimate(address: Address, weight: number = 0.5): Promise<{
    canShip: boolean;
    estimatedCost: number;
    estimatedDays: number;
    availableCouriers: string[];
  }> {
    try {
      const validated = await this.validateAndFixAddress(address);
      
      if (!validated.isServiceable) {
        return {
          canShip: false,
          estimatedCost: 0,
          estimatedDays: 0,
          availableCouriers: []
        };
      }

      // Calculate cost based on weight and distance (simplified)
      const baseCost = 50;
      const weightCost = Math.max(0, (weight - 0.5) * 20);
      const estimatedCost = baseCost + weightCost;

      return {
        canShip: true,
        estimatedCost,
        estimatedDays: validated.serviceabilityDetails?.prepaid ? 3 : 5,
        availableCouriers: validated.serviceabilityDetails?.prepaid ? ["delhivery", "blue-dart"] : ["delhivery"]
      };
      
    } catch (error) {
      return {
        canShip: false,
        estimatedCost: 0,
        estimatedDays: 0,
        availableCouriers: []
      };
    }
  }
}
