import type { Express } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { delhiveryService, type PincodeServiceabilityResult } from "./delhiveryService";
import { AddressValidationService } from "./addressValidationService";

export const shippingRoutes = (app: Express) => {
  const authUser = createAuthMiddleware(["user", "admin"]);

  /**
   * Check if a single pincode is serviceable
   * GET /api/shipping/pincode/:pincode
   */
  app.get("/api/shipping/pincode/:pincode", async (req, res) => {
    try {
      const { pincode } = req.params;
      
      if (!pincode || pincode.length !== 6) {
        return res.status(400).json({
          success: false,
          message: "Invalid pincode format. Pincode must be 6 digits."
        });
      }

      const result = await delhiveryService.checkPincodeServiceability(pincode);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Pincode serviceability check failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check pincode serviceability"
      });
    }
  });

  /**
   * Check multiple pincodes at once
   * POST /api/shipping/pincodes/check
   */
  app.post("/api/shipping/pincodes/check", authUser, async (req, res) => {
    try {
      const { pincodes } = req.body;
      
      if (!Array.isArray(pincodes) || pincodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Pincodes array is required"
        });
      }

      if (pincodes.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Maximum 100 pincodes can be checked at once"
        });
      }

      const results = await delhiveryService.checkMultiplePincodes(pincodes);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error("Multiple pincode serviceability check failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check pincodes serviceability"
      });
    }
  });

  /**
   * Get shipping service configuration
   * GET /api/shipping/config
   */
  app.get("/api/shipping/config", async (req, res) => {
    try {
      const config = delhiveryService.getConfig();
      
      res.json({
        success: true,
        data: {
          provider: "Delhivery",
          ...config
        }
      });
    } catch (error) {
      console.error("Failed to get shipping config:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get shipping configuration"
      });
    }
  });

  /**
   * Validate shipping address (including pincode serviceability)
   * POST /api/shipping/validate-address
   */
  app.post("/api/shipping/validate-address", authUser, async (req, res) => {
    try {
      const { pincode, city, state, address } = req.body;
      
      if (!pincode || !city || !state || !address) {
        return res.status(400).json({
          success: false,
          message: "All address fields are required: pincode, city, state, address"
        });
      }

      // Check pincode serviceability
      const serviceabilityResult = await delhiveryService.checkPincodeServiceability(pincode);
      
      // Validate city and state match with Delhivery data
      let cityValid = true;
      let stateValid = true;
      
      if (serviceabilityResult.isServiceable) {
        cityValid = serviceabilityResult.city.toLowerCase() === city.toLowerCase();
        stateValid = serviceabilityResult.state.toLowerCase() === state.toLowerCase();
      }

      const validationResult = {
        isServiceable: serviceabilityResult.isServiceable,
        prepaid: serviceabilityResult.prepaid,
        cod: serviceabilityResult.cod,
        cityValid,
        stateValid,
        delhiveryCity: serviceabilityResult.city,
        delhiveryState: serviceabilityResult.state,
        errors: [] as string[]
      };

      // Collect validation errors
      if (!serviceabilityResult.isServiceable) {
        validationResult.errors.push("Pincode is not serviceable by Delhivery");
      }
      if (!cityValid) {
        validationResult.errors.push(`City mismatch. Expected: ${serviceabilityResult.city}`);
      }
      if (!stateValid) {
        validationResult.errors.push(`State mismatch. Expected: ${serviceabilityResult.state}`);
      }

      res.json({
        success: true,
        data: validationResult
      });
    } catch (error) {
      console.error("Address validation failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate address"
      });
    }
  });

  /**
   * 🆕 Validate and fix address automatically
   * POST /api/shipping/validate-address
   */
  app.post("/api/shipping/validate-address", authUser, async (req, res) => {
    try {
      const address = req.body;
      
      if (!address || !address.pincode || !address.city) {
        return res.status(400).json({
          success: false,
          message: "Address with pincode and city is required"
        });
      }

      const validationResult = await AddressValidationService.validateAndFixAddress(address);
      
      res.json({
        success: true,
        data: validationResult
      });
    } catch (error) {
      console.error("Address validation failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate address"
      });
    }
  });

  /**
   * 🆕 Get shipping estimate for address
   * POST /api/shipping/estimate
   */
  app.post("/api/shipping/estimate", authUser, async (req, res) => {
    try {
      const { address, method = "delhivery", weight = 0.5 } = req.body;
      
      if (!address || !address.pincode) {
        return res.status(400).json({
          success: false,
          message: "Address with pincode is required"
        });
      }

      const estimate = await AddressValidationService.getShippingEstimate(address, weight);
      
      res.json({
        success: true,
        data: estimate
      });
    } catch (error) {
      console.error("Shipping estimate failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get shipping estimate"
      });
    }
  });

  /**
   * 🆕 Check if address is serviceable
   * POST /api/shipping/check-serviceability
   */
  app.post("/api/shipping/check-serviceability", authUser, async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address || !address.pincode) {
        return res.status(400).json({
          success: false,
          message: "Address with pincode is required"
        });
      }

      const isServiceable = await AddressValidationService.isAddressServiceable(address);
      
      res.json({
        success: true,
        data: { isServiceable }
      });
    } catch (error) {
      console.error("Serviceability check failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check serviceability"
      });
    }
  });
};
