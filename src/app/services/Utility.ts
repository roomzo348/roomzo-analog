export interface Listing {
  id: number;
  title: string;
  location: string;
  price: number;
  priceUnit?: string; // e.g. '/month' or 'Total Price'
  image: string;
  photos?: any[];
  badge: { text: string; color: 'blue' | 'green' | 'purple' };
  specs: { beds: number; baths: number; area: number };
  rating?: number;
  isFavorite: boolean;
  postedDate?: string; // New field for posted date
}

export function mapBackendListingsToUi(list: any[]): Listing[] {
  return list.map(item => ({
    ...item,
    id: item.id,

    title: item.propertyName ?? item.property_name
      ? (item.propertyName ?? item.property_name)
      : item.propertyType?.toUpperCase() || 'Property',

    location: `${item.city}, ${item.state}`,

    price: item.rentAmount ?? item.rent_amount ?? 0,
    priceUnit: '/month',

    image: item.photos?.length
      ? item.photos[0].photoUrl
      : 'assets/no-image.jpg',

    photos: item.photos ?? [],

    badge: {
      text: item.isRented === 1 ? 'RENTED' : 'FOR RENT',
      color: item.isRented === 1 ?  'blue' : 'green'
    },

    specs: {
      beds: item.bedrooms,
      baths: item.bathrooms,
      area: item.propertySize ?? item.property_size ?? 0
    },
    rating: (item.avgRating ?? item.avg_rating) && (item.reviewCount ?? item.review_count) > 0
      ? +Number(item.avgRating ?? item.avg_rating).toFixed(1)
      : undefined,

    // Random boolean for favorite
    isFavorite: Math.random() >= 0.5,
    
    // Include posted date from backend
    postedDate: item.dateCreated || item.createdOn || item.created_on || new Date().toISOString()
  }));
}

export function getAmenitiesMap() {
  return [
    { key: 'bed', label: 'Bed & Mattress', icon: 'bed', dbKey: 'hasBed' },
    { key: 'almirah', label: 'Almirah / Cupboard', icon: 'door_sliding', dbKey: 'hasAlmirah' },
    { key: 'studyTable', label: 'Study Table & Chair', icon: 'desk', dbKey: 'hasStudyTable' },
    { key: 'fanLight', label: 'Fan & Tube Light', icon: 'mode_fan', dbKey: 'hasFanLight' },
    { key: 'roWater', label: 'RO Water Purifier', icon: 'water_drop', dbKey: 'hasRoWater' },
    { key: 'inverter', label: 'Power Backup', icon: 'battery_charging_full', dbKey: 'hasInverter' },
    { key: 'cooling', label: 'AC / Air Cooler', icon: 'ac_unit', dbKey: 'hasCooling' },
    { key: 'geyser', label: 'Geyser (Hot Water)', icon: 'hot_tub', dbKey: 'hasGeyser' },
    { key: 'wifi', label: 'Wi-Fi Internet', icon: 'wifi', dbKey: 'hasWifi' },
    { key: 'parking', label: 'Parking Space', icon: 'local_parking', dbKey: 'hasParking' },
    { key: 'cctv', label: 'CCTV Security', icon: 'videocam', dbKey: 'hasCctv' },
    { key: 'washingMachine', label: 'Washing Machine', icon: 'local_laundry_service', dbKey: 'hasWashingMachine' },
    { key: 'kitchen', label: 'Kitchen Access', icon: 'kitchen', dbKey: 'hasKitchen' }
  ];
}

export function getListingConditionsMap() {
  return [
    { key: 'coupleFriendly', label: 'Couple Friendly', icon: 'favorite', dbKey: 'coupleFriendly' },
    { key: 'forBoys', label: 'For Boys', icon: 'male', dbKey: 'forBoys' },
    { key: 'forGirls', label: 'For Girls', icon: 'female', dbKey: 'forGirls' },
    { key: 'water24x7', label: '24×7 Water', icon: 'water_drop', dbKey: 'water24x7' },
    { key: 'vegOnly', label: 'Veg Only', icon: 'restaurant', dbKey: 'vegOnly' },
    { key: 'familyFriendly', label: 'Family Friendly', icon: 'family_restroom', dbKey: 'familyFriendly' },
    { key: 'studentsOnly', label: 'Students Only', icon: 'school', dbKey: 'studentsOnly' },
    { key: 'workingProfessionals', label: 'Working Professionals', icon: 'work', dbKey: 'workingProfessionals' }
  ];
}