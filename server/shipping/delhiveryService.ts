import axios from 'axios';

export interface DelhiveryPincodeResponse {
  delivery_codes: Array<{
    postal_code: {
      remarks: string;
      pin: number;
      country_code: string;
      state_code: string;
      cod: string; // "Y" or "N"
      pre_paid: string; // "Y" or "N"
      pickup: string; // "Y" or "N"
      cash: string; // "Y" or "N"
      repl: string; // "Y" or "N"
      district: string;
      is_oda: string; // "Y" or "N"
      sort_code: string;
      max_amount: number;
      max_weight: number;
      covid_zone: string;
      inc: string;
      center: Array<{
        code: string;
        cn: string; // center name
        s: string; // start date
        e: string; // end date
        u: string; // user
        ud?: string; // user date
        sort_code?: string;
      }>;
      city: string;
      sun_tat: boolean;
      protect_blacklist: boolean;
      srv_wt_th: number;
    };
  }>;
  success?: boolean;
}

export interface PincodeServiceabilityResult {
  isServiceable: boolean;
  prepaid: boolean;
  cod: boolean;
  city: string;
  state: string;
  country: string;
  error?: string;
}

export class DelhiveryService {
  private baseUrl: string;
  private apiToken: string;
  private clientId: string;

  constructor() {
    this.apiToken = process.env.DELHIVERY_API_TOKEN!;
    this.clientId = process.env.DELHIVERY_CLIENT_ID!;
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.DELHIVERY_PRODUCTION_URL!
      : process.env.DELHIVERY_TEST_URL!;
  }

  /**
   * Check if a pincode is serviceable by Delhivery
   * @param pincode - The pincode to check
   * @returns Serviceability details
   */
  async checkPincodeServiceability(pincode: string): Promise<PincodeServiceabilityResult> {
    try {
      if (!pincode || pincode.length !== 6) {
        return {
          isServiceable: false,
          prepaid: false,
          cod: false,
          city: '',
          state: '',
          country: '',
          error: 'Invalid pincode format'
        };
      }

      const url = `${this.baseUrl}/c/api/pin-codes/json/`;
      const params = {
        filter_codes: pincode
      };
      const response = await axios.get<DelhiveryPincodeResponse>(url, {
        params,
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (!response.data.delivery_codes.length) {
        return {
          isServiceable: false,
          prepaid: false,
          cod: false,
          city: '',
          state: '',
          country: '',
          error: 'Pincode not serviceable'
        };
      }

      const requestedPincode = pincode.toString();
      const pincodeEntry = response.data.delivery_codes.find(
        (entry: any) => entry.postal_code.pin.toString() === requestedPincode
      );

      if (!pincodeEntry) {
        return {
          isServiceable: false,
          prepaid: false,
          cod: false,
          city: '',
          state: '',
          country: '',
          error: 'Pincode not found in serviceability data'
        };
      }

      const pincodeData = pincodeEntry.postal_code;

      // Check if the pincode is currently serviceable by looking at active centers
      const activeCenters = pincodeData.center.filter((center: any) =>
        center.code !== 'NSZ' && !center.e // NSZ means Not Serviceable Zone, no end date means still active
      );

      return {
        isServiceable: activeCenters.length > 0 && (pincodeData.pre_paid === 'Y' || pincodeData.cod === 'Y'),
        prepaid: pincodeData.pre_paid === 'Y',
        cod: pincodeData.cod === 'Y',
        city: pincodeData.city,
        state: pincodeData.district, // Delhivery provides district instead of state
        country: pincodeData.country_code
      };

    } catch (error) {
      console.error('Delhivery pincode serviceability check failed:', error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        return {
          isServiceable: false,
          prepaid: false,
          cod: false,
          city: '',
          state: '',
          country: '',
          error: `API Error (${status}): ${message}`
        };
      }

      return {
        isServiceable: false,
        prepaid: false,
        cod: false,
        city: '',
        state: '',
        country: '',
        error: 'Failed to check pincode serviceability'
      };
    }
  }

  /**
   * Check multiple pincodes at once
   * @param pincodes - Array of pincodes to check
   * @returns Array of serviceability results
   */
  async checkMultiplePincodes(pincodes: string[]): Promise<PincodeServiceabilityResult[]> {
    try {
      if (!pincodes.length || pincodes.length > 100) {
        throw new Error('Invalid number of pincodes. Minimum 1, maximum 100.');
      }

      const validPincodes = pincodes.filter(pin => pin && pin.length === 6);
      if (validPincodes.length !== pincodes.length) {
        throw new Error('All pincodes must be 6 digits');
      }

      const url = `${this.baseUrl}/c/api/pin-codes/json/`;
      const params = { pin_codes: validPincodes.join(',') };

      const response = await axios.get<DelhiveryPincodeResponse>(url, {
        params,
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      const results: PincodeServiceabilityResult[] = [];
      const pincodeMap = new Map(response.data.delivery_codes.map(code => [code.postal_code.pin.toString(), code.postal_code]));

      for (const pincode of pincodes) {
        const pincodeData = pincodeMap.get(pincode);

        if (pincodeData) {
          // Check if the pincode is currently serviceable by looking at active centers
          const activeCenters = pincodeData.center.filter((center: any) =>
            center.code !== 'NSZ' && !center.e // NSZ means Not Serviceable Zone, no end date means still active
          );

          results.push({
            isServiceable: activeCenters.length > 0 && (pincodeData.pre_paid === 'Y' || pincodeData.cod === 'Y'),
            prepaid: pincodeData.pre_paid === 'Y',
            cod: pincodeData.cod === 'Y',
            city: pincodeData.city,
            state: pincodeData.district, // Delhivery provides district instead of state
            country: pincodeData.country_code
          });
        } else {
          results.push({
            isServiceable: false,
            prepaid: false,
            cod: false,
            city: '',
            state: '',
            country: '',
            error: 'Pincode not serviceable'
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Delhivery multiple pincode serviceability check failed:', error);

      // Return error results for all pincodes
      return pincodes.map(pincode => ({
        isServiceable: false,
        prepaid: false,
        cod: false,
        city: '',
        state: '',
        country: '',
        error: axios.isAxiosError(error) ? error.message : 'Failed to check pincode serviceability'
      }));
    }
  }

  /**
   * Get service configuration
   */
  getConfig() {
    return {
      clientId: this.clientId,
      baseUrl: this.baseUrl,
      isTestMode: process.env.NODE_ENV !== 'production'
    };
  }
}

export const delhiveryService = new DelhiveryService();
