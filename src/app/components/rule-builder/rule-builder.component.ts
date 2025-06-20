import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import * as courierData from '../../../assets/couriers_detailed.json';

@Component({
  selector: 'app-rule-builder',
  templateUrl: './rule-builder.component.html',
  styleUrls: ['./rule-builder.component.scss']
})
export class RuleBuilderComponent {
  ruleText: string = 'For prepaid orders to Mumbai over 500gm, assign Delhivery.';
  parsedRule: any = null;
  warnings: string[] = [];
  isLoading: boolean = false;
  
  courierList: any;
  filteredCouriers: any[] = [];

  constructor(private apiService: ApiService) {
    // Flatten the new data structure into an array of courier objects with a 'name' property
    const rawData = (courierData as any).default || courierData;
    this.courierList = [];
    for (const group of rawData) {
      for (const name in group) {
        if (group.hasOwnProperty(name)) {
          const courier = { name, ...group[name] };
          // Convert min_weight and other numeric fields to numbers
          if (courier.min_weight !== undefined) {
            courier.min_weight = parseFloat(courier.min_weight);
          }
          if (courier.surface_max_weight !== undefined) {
            courier.surface_max_weight = parseFloat(courier.surface_max_weight);
          }
          if (courier.air_max_weight !== undefined) {
            courier.air_max_weight = parseFloat(courier.air_max_weight);
          }
          this.courierList.push(courier);
        }
      }
    }
  }

  onGenerateRule() {
    if (!this.ruleText.trim()) return;

    this.isLoading = true;
    this.parsedRule = null;
    this.warnings = [];
    this.filteredCouriers = [];

    this.apiService.generateRule(this.ruleText).subscribe({
      next: (response) => {
        this.parsedRule = response.rule;
        this.warnings = response.warnings;
        this.filteredCouriers = this.filterCouriersByRule(this.courierList, this.parsedRule);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('An error occurred:', err);
        this.warnings = ['Failed to parse the rule. Please check the browser console for details.'];
        this.isLoading = false;
      }
    });
  }

  filterCouriersByRule(couriers: any[], rule: any): any[] {
    if (!rule || !rule.conditions) return couriers;

    // Initialize filter variables
    let minWeight: number | null = null;
    let maxWeight: number | null = null;
    let mode: number | null = null;
    let callBeforeDelivery: number | null = null;
    let realtimeTracking: number | null = null;
    let deliveryBoyContact: number | null = null;
    let podAvailable: number | null = null;
    let codMinValue: number | null = null;
    let codMaxValue: number | null = null;
    let prepaidMinValue: number | null = null;
    let prepaidMaxValue: number | null = null;
    let countryWide: number | null = null;
    let status: number | null = null;
    let isHyperlocal: number | null = null;
    let nameContains: string | null = null;
    let cutOffTimeAfter: string | null = null;
    let isDgRestricted: number | null = null;

    for (const cond of rule.conditions) {
      // Weight
      if (cond.field === 'weight') {
        let value = cond.valueKg !== undefined ? cond.valueKg : cond.value;
        let unit = 'kg';
        if (cond.unit) {
          unit = cond.unit.toLowerCase();
        } else if (typeof cond.value === 'string' && cond.value.toLowerCase().includes('g')) {
          unit = 'g';
        }
        if (unit === 'g' || unit === 'gram' || unit === 'grams') {
          value = parseFloat(value) / 1000;
        }
        if (cond.operator === '>=') minWeight = value;
        if (cond.operator === '>') minWeight = value + 0.001;
        if (cond.operator === '<=') maxWeight = value;
        if (cond.operator === '<') maxWeight = value - 0.001;
      }
      // Mode (air/surface)
      if (
        (cond.field === 'mode' && (cond.value === 1 || cond.value === '1' || cond.value === 'air')) ||
        (cond.field === 'service_type' && (cond.value === 1 || cond.value === '1' || cond.value.toString().toLowerCase().includes('air')))
      ) {
        mode = 1;
      }
      if (
        (cond.field === 'mode' && (cond.value === 0 || cond.value === '0' || cond.value === 'surface')) ||
        (cond.field === 'service_type' && (cond.value === 0 || cond.value === '0' || cond.value.toString().toLowerCase().includes('surface')))
      ) {
        mode = 0;
      }
      // Call before delivery
      if (cond.field === 'call_before_delivery' && (
        cond.value === 1 ||
        cond.value === '1' ||
        cond.value === true ||
        (typeof cond.value === 'string' && (
          cond.value.toLowerCase() === 'yes' ||
          cond.value.toLowerCase() === 'available' ||
          cond.value.toLowerCase() === 'on request'
        ))
      )) {
        callBeforeDelivery = 1;
      }
      // Real-time tracking
      if (cond.field === 'realtime_tracking' && (cond.value === 1 || cond.value === '1' || cond.value === true || (typeof cond.value === 'string' && cond.value.toLowerCase() === 'yes'))) {
        realtimeTracking = 1;
      }
      // Delivery boy contact
      if (cond.field === 'delivery_boy_contact' && (cond.value === 1 || cond.value === '1' || cond.value === true || (typeof cond.value === 'string' && cond.value.toLowerCase() === 'yes'))) {
        deliveryBoyContact = 1;
      }
      // POD available
      if (cond.field === 'pod_available' && (cond.value === 1 || cond.value === '1' || cond.value === true || (typeof cond.value === 'string' && cond.value.toLowerCase() === 'yes'))) {
        podAvailable = 1;
      }
      // COD max value
      if (cond.field === 'cod_max_value' && cond.operator && cond.value) {
        if (cond.operator === '>=') codMinValue = cond.value;
        if (cond.operator === '<=') codMaxValue = cond.value;
      }
      // Prepaid max value
      if (cond.field === 'prepaid_max_value' && cond.operator && cond.value) {
        if (cond.operator === '>=') prepaidMinValue = cond.value;
        if (cond.operator === '<=') prepaidMaxValue = cond.value;
      }
      // Countrywide delivery
      if (cond.field === 'country_wide_delivery' && (cond.value === 1 || cond.value === '1' || cond.value === true)) {
        countryWide = 1;
      }
      // Status/active
      if (cond.field === 'status' && (cond.value === 1 || cond.value === '1' || cond.value === true)) {
        status = 1;
      }
      // Hyperlocal
      if (cond.field === 'is_hyperlocal' && (cond.value === 1 || cond.value === '1' || cond.value === true)) {
        isHyperlocal = 1;
      }
      // Name contains
      if (cond.field === 'name' && cond.value) {
        nameContains = cond.value.toString().toLowerCase();
      }
      // Cut-off time after
      if (cond.field === 'cut_off_time' && cond.operator === '>' && cond.value) {
        cutOffTimeAfter = cond.value;
      }
      // Dangerous goods restriction
      if (cond.field === 'is_dg_restricted_courier' && (cond.value === 0 || cond.value === '0' || cond.value === false)) {
        isDgRestricted = 0;
      }
    }

    return couriers.filter(courier => {
      if (minWeight !== null && courier.min_weight !== undefined && courier.min_weight > minWeight) return false;
      if (maxWeight !== null && courier.min_weight !== undefined && courier.min_weight > maxWeight) return false;
      if (mode !== null && courier.mode !== undefined && Number(courier.mode) !== mode) return false;
      if (callBeforeDelivery !== null && courier.call_before_delivery !== undefined && Number(courier.call_before_delivery) !== callBeforeDelivery) return false;
      if (realtimeTracking !== null && courier.realtime_tracking !== undefined && Number(courier.realtime_tracking) !== realtimeTracking) return false;
      if (deliveryBoyContact !== null && courier.delivery_boy_contact !== undefined && Number(courier.delivery_boy_contact) !== deliveryBoyContact) return false;
      if (podAvailable !== null && courier.pod_available !== undefined && Number(courier.pod_available) !== podAvailable) return false;
      if (codMinValue !== null && courier.cod_max_value !== undefined && Number(courier.cod_max_value) < codMinValue) return false;
      if (codMaxValue !== null && courier.cod_max_value !== undefined && Number(courier.cod_max_value) > codMaxValue) return false;
      if (prepaidMinValue !== null && courier.prepaid_max_value !== undefined && Number(courier.prepaid_max_value) < prepaidMinValue) return false;
      if (prepaidMaxValue !== null && courier.prepaid_max_value !== undefined && Number(courier.prepaid_max_value) > prepaidMaxValue) return false;
      if (countryWide !== null && courier.country_wide_delivery !== undefined && Number(courier.country_wide_delivery) !== countryWide) return false;
      if (status !== null && courier.status !== undefined && Number(courier.status) !== status) return false;
      if (isHyperlocal !== null && courier.is_hyperlocal !== undefined && Number(courier.is_hyperlocal) !== isHyperlocal) return false;
      if (nameContains && courier.name && !courier.name.toLowerCase().includes(nameContains)) return false;
      if (cutOffTimeAfter && courier.cut_off_time && courier.cut_off_time <= cutOffTimeAfter) return false;
      if (isDgRestricted !== null && courier.is_dg_restricted_courier !== undefined && Number(courier.is_dg_restricted_courier) !== isDgRestricted) return false;
      return true;
    });
  }
}
