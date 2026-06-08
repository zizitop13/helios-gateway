export interface Pet {
  id: string;
  name: string;
  species: string;
  status: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  tier: string;
}

export interface Order {
  id: string;
  status: string;
  total: number;
  pet: Pick<Pet, 'id' | 'name' | 'species' | 'status'>;
  customer: Pick<Customer, 'id' | 'name' | 'tier' | 'email'>;
}

export interface UpdateOrderInput {
  status?: string;
  total?: number;
  petId?: string;
  customerId?: string;
}

export interface DashboardData {
  pets: Pet[];
  orders: Order[];
  customers: Customer[];
}
