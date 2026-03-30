export type VehicleCategory = 'Economy' | 'Sedan' | 'SUV' | 'Premium';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  category: VehicleCategory;
  dailyRate: number;
  weeklyRate: number;
  seats: number;
  fuel: string;
  mpg: number;
  transmission: string;
  image: string;
  images: string[];
  description: string;
  features: string[];
  included: string[];
}

export interface Review {
  id: string;
  vehicleId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  avatar?: string;
  date?: string;
}

export interface BookingRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  startDate: string;
  endDate: string;
  pickupTime: string;
  returnTime: string;
  pickupLocation: string;
  insuranceNeeded: 'yes' | 'no' | 'not-sure';
  notes: string;
  vehicleId: string;
  vehicleName: string;
  vehicleDailyRate: number;
}

export type SortOption = 'default' | 'price-asc' | 'price-desc' | 'year-desc';
export type FilterCategory = 'all' | VehicleCategory;
