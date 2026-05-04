/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any; }
  /** Arbitrary JSON value */
  JSON: { input: any; output: any; }
};

export enum AlertSeverity {
  Critical = 'critical',
  Info = 'info',
  Warning = 'warning'
}

export type Appointment = {
  __typename?: 'Appointment';
  customer?: Maybe<Customer>;
  endAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  items: Array<AppointmentItem>;
  locationId?: Maybe<Scalars['ID']['output']>;
  locationName?: Maybe<Scalars['String']['output']>;
  salePaymentStatus?: Maybe<SalePaymentStatus>;
  staffUser?: Maybe<StaffUser>;
  startAt: Scalars['DateTime']['output'];
  status: AppointmentStatus;
  totalCents: Scalars['Int']['output'];
};

export type AppointmentItem = {
  __typename?: 'AppointmentItem';
  catalogComboId?: Maybe<Scalars['ID']['output']>;
  label: Scalars['String']['output'];
  qty: Scalars['Int']['output'];
  serviceId?: Maybe<Scalars['ID']['output']>;
  unitPriceCents: Scalars['Int']['output'];
};

export enum AppointmentStatus {
  Cancelled = 'CANCELLED',
  CheckedIn = 'CHECKED_IN',
  Completed = 'COMPLETED',
  Confirmed = 'CONFIRMED',
  Hold = 'HOLD',
  InService = 'IN_SERVICE',
  NoShow = 'NO_SHOW'
}

export type AssignRoleToStaffInput = {
  endsAt?: InputMaybe<Scalars['DateTime']['input']>;
  locationId?: InputMaybe<Scalars['ID']['input']>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  roleId: Scalars['ID']['input'];
  scopeType: ScopeType;
  staffUserId: Scalars['ID']['input'];
  startsAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type AssignWalkInResult = {
  __typename?: 'AssignWalkInResult';
  walkIn: WalkIn;
  warning?: Maybe<Scalars['String']['output']>;
};

export type AuthResult = {
  __typename?: 'AuthResult';
  viewer: Viewer;
};

export type AvailableSlotsInput = {
  date: Scalars['String']['input'];
  items: Array<BookingItemInput>;
  locationId: Scalars['ID']['input'];
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
};

export type BarberOnDuty = {
  __typename?: 'BarberOnDuty';
  fullName: Scalars['String']['output'];
  hasClockedIn: Scalars['Boolean']['output'];
  nextAppointmentAt?: Maybe<Scalars['DateTime']['output']>;
  staffUserId: Scalars['ID']['output'];
  status: Scalars['String']['output'];
};

export type BlogPost = {
  __typename?: 'BlogPost';
  contentJson?: Maybe<Scalars['JSON']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  slug: Scalars['String']['output'];
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export enum BookingChannel {
  Manual = 'MANUAL',
  Online = 'ONLINE'
}

export type BookingDraftResult = {
  __typename?: 'BookingDraftResult';
  amountDueNowCents: Scalars['Int']['output'];
  appointment: Appointment;
  currency: Scalars['String']['output'];
  sale: Sale;
};

export type BookingItemInput = {
  catalogComboId?: InputMaybe<Scalars['ID']['input']>;
  qty?: InputMaybe<Scalars['Int']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
};

export enum BookingPaymentMode {
  Deposit = 'DEPOSIT',
  Full = 'FULL',
  None = 'NONE'
}

export type BulkPriceResult = {
  __typename?: 'BulkPriceResult';
  skipped: Array<BulkSkipped>;
  updated: Scalars['Int']['output'];
  variantsUpdated: Scalars['Int']['output'];
};

export type BulkProductResult = {
  __typename?: 'BulkProductResult';
  skipped: Array<BulkSkipped>;
  updated: Scalars['Int']['output'];
};

export type BulkSkipped = {
  __typename?: 'BulkSkipped';
  id: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

export type CancelAppointmentByTokenResult = {
  __typename?: 'CancelAppointmentByTokenResult';
  ok: Scalars['Boolean']['output'];
  refundAllowed: Scalars['Boolean']['output'];
};

export type CancelAppointmentResult = {
  __typename?: 'CancelAppointmentResult';
  ok: Scalars['Boolean']['output'];
  refundAllowed: Scalars['Boolean']['output'];
};

export type CatalogCategory = {
  __typename?: 'CatalogCategory';
  appliesTo: CategoryAppliesTo;
  children: Array<CatalogCategory>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imagePublicId?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<CatalogCategory>;
  parentId?: Maybe<Scalars['ID']['output']>;
  slug: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
};

export type CatalogCombo = {
  __typename?: 'CatalogCombo';
  commissionCents: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  effectiveCategories: Array<CatalogCategory>;
  effectiveCategoryIds: Array<Scalars['ID']['output']>;
  extraCategoryIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  imagePublicId?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  isActive: Scalars['Boolean']['output'];
  items: Array<CatalogComboItem>;
  locations: Array<CatalogComboLocation>;
  name: Scalars['String']['output'];
  penaltyCommissionCents: Scalars['Int']['output'];
  priceCents: Scalars['Int']['output'];
  slug: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  totalDurationMin: Scalars['Int']['output'];
};


export type CatalogComboTotalDurationMinArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
};

export type CatalogComboItem = {
  __typename?: 'CatalogComboItem';
  id: Scalars['ID']['output'];
  productId?: Maybe<Scalars['ID']['output']>;
  productName?: Maybe<Scalars['String']['output']>;
  qty: Scalars['Int']['output'];
  serviceId?: Maybe<Scalars['ID']['output']>;
  serviceName?: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
};

export type CatalogComboItemInput = {
  productId?: InputMaybe<Scalars['ID']['input']>;
  qty?: InputMaybe<Scalars['Int']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type CatalogComboLocation = {
  __typename?: 'CatalogComboLocation';
  comboId: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  locationId: Scalars['ID']['output'];
  priceCentsOverride?: Maybe<Scalars['Int']['output']>;
};

export enum CategoryAppliesTo {
  Any = 'ANY',
  Combo = 'COMBO',
  Product = 'PRODUCT',
  Service = 'SERVICE'
}

export type CloseRegisterSessionInput = {
  countedCardCents: Scalars['Int']['input'];
  countedCashCents: Scalars['Int']['input'];
  countedTransferCents: Scalars['Int']['input'];
  sessionId: Scalars['ID']['input'];
};

export type CloudinaryConfig = {
  __typename?: 'CloudinaryConfig';
  cloudName: Scalars['String']['output'];
};

export type CloudinaryUploadSignature = {
  __typename?: 'CloudinaryUploadSignature';
  apiKey: Scalars['String']['output'];
  cloudName: Scalars['String']['output'];
  folder: Scalars['String']['output'];
  signature: Scalars['String']['output'];
  timestamp: Scalars['Int']['output'];
};

export type CreateBlogPostInput = {
  contentJson?: InputMaybe<Scalars['JSON']['input']>;
  slug: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateBookingDraftInput = {
  channel?: InputMaybe<BookingChannel>;
  customerEmail: Scalars['String']['input'];
  customerFullName: Scalars['String']['input'];
  customerPhone?: InputMaybe<Scalars['String']['input']>;
  items: Array<BookingItemInput>;
  locationId: Scalars['ID']['input'];
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
  startAt: Scalars['DateTime']['input'];
};

export type CreateCatalogCategoryInput = {
  appliesTo?: InputMaybe<CategoryAppliesTo>;
  description?: InputMaybe<Scalars['String']['input']>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
  slug: Scalars['String']['input'];
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateCatalogComboInput = {
  commissionCents: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  extraCategoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  items: Array<CatalogComboItemInput>;
  name: Scalars['String']['input'];
  penaltyCommissionCents: Scalars['Int']['input'];
  priceCents: Scalars['Int']['input'];
  slug: Scalars['String']['input'];
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateGroupBookingInput = {
  appointments: Array<GroupBookingAppointmentInput>;
  locationId: Scalars['ID']['input'];
  partyLabel?: InputMaybe<Scalars['String']['input']>;
};

export type CreateGroupBookingResult = {
  __typename?: 'CreateGroupBookingResult';
  appointments: Array<Appointment>;
  partyId: Scalars['ID']['output'];
  sales: Array<Sale>;
};

export type CreateLatenessExcuseInput = {
  localDate: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  staffUserId: Scalars['ID']['input'];
};

export type CreateLocationBlackoutInput = {
  date: Scalars['String']['input'];
  label: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  type: Scalars['String']['input'];
};

export type CreateLocationInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  slug: Scalars['String']['input'];
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type CreateOrderInput = {
  customerId?: InputMaybe<Scalars['ID']['input']>;
  items: Array<CreateOrderItemInput>;
  pickupLocationId?: InputMaybe<Scalars['ID']['input']>;
  shippingAddress?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
};

export type CreateOrderItemInput = {
  productId: Scalars['ID']['input'];
  qty: Scalars['Int']['input'];
  variantId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreatePosSaleInput = {
  completeAppointmentId?: InputMaybe<Scalars['ID']['input']>;
  completeWalkInId?: InputMaybe<Scalars['ID']['input']>;
  customerId?: InputMaybe<Scalars['ID']['input']>;
  items: Array<PosSaleItemInput>;
  locationId: Scalars['ID']['input'];
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  registerSessionId?: InputMaybe<Scalars['ID']['input']>;
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
  tipCents?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateProductInput = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  commissionCents?: InputMaybe<Scalars['Int']['input']>;
  compareAtPriceCents?: InputMaybe<Scalars['Int']['input']>;
  costCents?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  handle?: InputMaybe<Scalars['String']['input']>;
  heightMm?: InputMaybe<Scalars['Int']['input']>;
  hsCode?: InputMaybe<Scalars['String']['input']>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  lengthMm?: InputMaybe<Scalars['Int']['input']>;
  locationIds: Array<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  penaltyCommissionCents?: InputMaybe<Scalars['Int']['input']>;
  productType?: InputMaybe<Scalars['String']['input']>;
  requiresShipping?: InputMaybe<Scalars['Boolean']['input']>;
  seoDescription?: InputMaybe<Scalars['String']['input']>;
  seoTitle?: InputMaybe<Scalars['String']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProductStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  taxCode?: InputMaybe<Scalars['String']['input']>;
  taxable?: InputMaybe<Scalars['Boolean']['input']>;
  variants?: InputMaybe<Array<CreateProductVariantInput>>;
  vendor?: InputMaybe<Scalars['String']['input']>;
  weightGrams?: InputMaybe<Scalars['Int']['input']>;
  widthMm?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateProductVariantInput = {
  barcode?: InputMaybe<Scalars['String']['input']>;
  compareAtPriceCents?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  option1?: InputMaybe<Scalars['String']['input']>;
  option2?: InputMaybe<Scalars['String']['input']>;
  option3?: InputMaybe<Scalars['String']['input']>;
  priceCents: Scalars['Int']['input'];
  sku?: InputMaybe<Scalars['String']['input']>;
};

export type CreateResourceInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isReservable: Scalars['Boolean']['input'];
  name: Scalars['String']['input'];
};

export type CreateRoleInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};

export type CreateServiceInput = {
  baseDurationMin: Scalars['Int']['input'];
  basePriceCents: Scalars['Int']['input'];
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  commissionCents?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  isAddOn?: InputMaybe<Scalars['Boolean']['input']>;
  locationIds: Array<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  penaltyCommissionCents?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateShiftOverrideInput = {
  blocks?: InputMaybe<Array<ShiftBlockInput>>;
  date: Scalars['String']['input'];
  endMin?: InputMaybe<Scalars['Int']['input']>;
  locationId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  staffUserId: Scalars['ID']['input'];
  startMin?: InputMaybe<Scalars['Int']['input']>;
  type: ShiftOverrideType;
};

export type CreateStaffInput = {
  email: Scalars['String']['input'];
  fullName: Scalars['String']['input'];
  password: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  photoPublicId?: InputMaybe<Scalars['String']['input']>;
  photoUrl?: InputMaybe<Scalars['String']['input']>;
  posPin4?: InputMaybe<Scalars['String']['input']>;
};

export type CreateStaffMembershipInput = {
  contextRole: StaffContextRole;
  endsAt?: InputMaybe<Scalars['DateTime']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
  startsAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateStaffVacationInput = {
  endDate: Scalars['String']['input'];
  label: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};

export type CreateStockLocationInput = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  type: StockLocationType;
};

export type Customer = {
  __typename?: 'Customer';
  address?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email?: Maybe<Scalars['String']['output']>;
  fullName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  noShowCount: Scalars['Int']['output'];
  phone?: Maybe<Scalars['String']['output']>;
  reputationNote?: Maybe<Scalars['String']['output']>;
  reputationScore?: Maybe<Scalars['Int']['output']>;
  reputationTag?: Maybe<CustomerReputationTag>;
};

export type CustomerRegisterInput = {
  email: Scalars['String']['input'];
  fullName: Scalars['String']['input'];
  password: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
};

export enum CustomerReputationTag {
  FlaggedByStaff = 'FLAGGED_BY_STAFF',
  FrequentNoShow = 'FREQUENT_NO_SHOW',
  OccasionalNoShow = 'OCCASIONAL_NO_SHOW',
  Reliable = 'RELIABLE'
}

export type DailyLocationMetrics = {
  __typename?: 'DailyLocationMetrics';
  appointmentCount: Scalars['Int']['output'];
  availableMinutes: Scalars['Int']['output'];
  cancelLt2hCount: Scalars['Int']['output'];
  chairReservableMinutes: Scalars['Int']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  localDate?: Maybe<Scalars['String']['output']>;
  locationId: Scalars['ID']['output'];
  noShowCount: Scalars['Int']['output'];
  occupancyMinutes: Scalars['Int']['output'];
  pendingTotalCents: Scalars['Int']['output'];
  refundCents: Scalars['Int']['output'];
  revenuePosCents: Scalars['Int']['output'];
  revenuePrepayCents: Scalars['Int']['output'];
  tipsCents: Scalars['Int']['output'];
};

export type DailyStaffMetrics = {
  __typename?: 'DailyStaffMetrics';
  commissionCents: Scalars['Int']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  latenessMinutes: Scalars['Int']['output'];
  locationId: Scalars['ID']['output'];
  revenueCents: Scalars['Int']['output'];
  staffUserId: Scalars['ID']['output'];
};

export type DashboardAlert = {
  __typename?: 'DashboardAlert';
  code: Scalars['String']['output'];
  cta: Scalars['String']['output'];
  locationId?: Maybe<Scalars['ID']['output']>;
  locationName?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  meta?: Maybe<Scalars['JSON']['output']>;
  severity: AlertSeverity;
};

export type DashboardFiltersInput = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type DashboardLocationRow = {
  __typename?: 'DashboardLocationRow';
  appointmentCount: Scalars['Int']['output'];
  availableMinutes: Scalars['Int']['output'];
  cancelLt2hCount: Scalars['Int']['output'];
  chairReservableMinutes: Scalars['Int']['output'];
  locationId: Scalars['ID']['output'];
  locationName: Scalars['String']['output'];
  noShowCount: Scalars['Int']['output'];
  occupancyMinutes: Scalars['Int']['output'];
  pendingTotalCents?: Maybe<Scalars['Int']['output']>;
  refundsTotalCents?: Maybe<Scalars['Int']['output']>;
  revenuePosCents?: Maybe<Scalars['Int']['output']>;
  revenuePrepayCents?: Maybe<Scalars['Int']['output']>;
  revenueTotalCents?: Maybe<Scalars['Int']['output']>;
  ticketPromedioCents?: Maybe<Scalars['Int']['output']>;
  tipsCents?: Maybe<Scalars['Int']['output']>;
};

export type DashboardSummary = {
  __typename?: 'DashboardSummary';
  byLocation: Array<DashboardLocationRow>;
  totals: DashboardTotals;
};

export type DashboardTotals = {
  __typename?: 'DashboardTotals';
  appointmentCount: Scalars['Int']['output'];
  cancelLt2hCount: Scalars['Int']['output'];
  cardCents?: Maybe<Scalars['Int']['output']>;
  cashCents?: Maybe<Scalars['Int']['output']>;
  commissionTotalCents?: Maybe<Scalars['Int']['output']>;
  noShowCount: Scalars['Int']['output'];
  revenueTotalCents?: Maybe<Scalars['Int']['output']>;
  transferCents?: Maybe<Scalars['Int']['output']>;
};

export enum DepositType {
  Fixed = 'FIXED',
  Percent = 'PERCENT'
}

export type GroupBookingAppointmentInput = {
  customerEmail: Scalars['String']['input'];
  customerFullName: Scalars['String']['input'];
  customerPhone?: InputMaybe<Scalars['String']['input']>;
  items: Array<BookingItemInput>;
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
  startAt: Scalars['DateTime']['input'];
};

export type InventoryAlertRow = {
  __typename?: 'InventoryAlertRow';
  lowStockThreshold?: Maybe<Scalars['Int']['output']>;
  productId: Scalars['ID']['output'];
  productName: Scalars['String']['output'];
  productVariantId?: Maybe<Scalars['ID']['output']>;
  quantity: Scalars['Int']['output'];
  stockLocationId: Scalars['ID']['output'];
  variantName?: Maybe<Scalars['String']['output']>;
};

export type InventoryLevel = {
  __typename?: 'InventoryLevel';
  id: Scalars['ID']['output'];
  product: Product;
  productId: Scalars['ID']['output'];
  quantity: Scalars['Int']['output'];
};

export type LatenessExcuse = {
  __typename?: 'LatenessExcuse';
  excusedAt: Scalars['DateTime']['output'];
  excusedByStaffUserId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  localDate: Scalars['String']['output'];
  locationId: Scalars['ID']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  staffUserId: Scalars['ID']['output'];
};

export type LatenessOverride = {
  __typename?: 'LatenessOverride';
  effectiveFrom: Scalars['DateTime']['output'];
  effectiveTo?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  locationId?: Maybe<Scalars['ID']['output']>;
  minutesLateThreshold?: Maybe<Scalars['Int']['output']>;
  staffUserId: Scalars['ID']['output'];
};

export type LatenessRule = {
  __typename?: 'LatenessRule';
  defaultMinutesLateThreshold: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  locationId: Scalars['ID']['output'];
};

export type Location = {
  __typename?: 'Location';
  hasPosPassword: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  mode: LocationMode;
  name: Scalars['String']['output'];
  photoPublicId?: Maybe<Scalars['String']['output']>;
  photoUrl?: Maybe<Scalars['String']['output']>;
  policies?: Maybe<LocationPolicy>;
  resources: Array<Resource>;
  slug: Scalars['String']['output'];
  timezone: Scalars['String']['output'];
};

export type LocationBlackout = {
  __typename?: 'LocationBlackout';
  createdAt: Scalars['DateTime']['output'];
  date: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  locationId: Scalars['ID']['output'];
  type: Scalars['String']['output'];
};

export type LocationBusinessHour = {
  __typename?: 'LocationBusinessHour';
  closeMin: Scalars['Int']['output'];
  dayIndex: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isOpen: Scalars['Boolean']['output'];
  locationId: Scalars['ID']['output'];
  openMin: Scalars['Int']['output'];
};

export enum LocationMode {
  BookingFocused = 'BOOKING_FOCUSED',
  Hybrid = 'HYBRID',
  WalkinFocused = 'WALKIN_FOCUSED'
}

export type LocationPolicy = {
  __typename?: 'LocationPolicy';
  bookingBufferAfterMin: Scalars['Int']['output'];
  bookingBufferBeforeMin: Scalars['Int']['output'];
  bookingPaymentMode: BookingPaymentMode;
  cancellationWindowMinutes: Scalars['Int']['output'];
  depositAmountCents?: Maybe<Scalars['Int']['output']>;
  depositMaxCents?: Maybe<Scalars['Int']['output']>;
  depositMinCents?: Maybe<Scalars['Int']['output']>;
  depositPercentBps?: Maybe<Scalars['Int']['output']>;
  depositType?: Maybe<DepositType>;
  holdDurationMinutes: Scalars['Int']['output'];
  lateBufferMinutes: Scalars['Int']['output'];
  minBookingLeadMinutes: Scalars['Int']['output'];
  walkinBlockWithinMinutes: Scalars['Int']['output'];
};

export type MessageLog = {
  __typename?: 'MessageLog';
  channel: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  meta?: Maybe<Scalars['JSON']['output']>;
  recipient: Scalars['String']['output'];
  sentAt?: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  templateCode?: Maybe<Scalars['String']['output']>;
};

export type MessageTemplate = {
  __typename?: 'MessageTemplate';
  channel: Scalars['String']['output'];
  code: Scalars['String']['output'];
  content?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  variables?: Maybe<Scalars['JSON']['output']>;
};

export type MetafieldDefinition = {
  __typename?: 'MetafieldDefinition';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  namespace: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export enum MetafieldOwnerType {
  Product = 'PRODUCT',
  Variant = 'VARIANT'
}

export type MetafieldValue = {
  __typename?: 'MetafieldValue';
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  namespace: Scalars['String']['output'];
  ownerId: Scalars['ID']['output'];
  ownerType: MetafieldOwnerType;
  type: Scalars['String']['output'];
  value?: Maybe<Scalars['JSON']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addProductImage: Product;
  assignPermissionsToRole: Role;
  assignRoleToStaff: Scalars['Boolean']['output'];
  assignWalkIn: AssignWalkInResult;
  bulkAdjustPrice: BulkPriceResult;
  bulkAssignCategory: BulkProductResult;
  bulkUpdateProductStatus: BulkProductResult;
  cancelAppointment: CancelAppointmentResult;
  cancelAppointmentByToken: CancelAppointmentByTokenResult;
  cancelOrder: Order;
  checkIn: Appointment;
  clearStaffPin: Scalars['Boolean']['output'];
  clockIn: Scalars['Boolean']['output'];
  clockOut: Scalars['Boolean']['output'];
  closeRegisterSession: RegisterSession;
  complete: Appointment;
  completeWalkIn: Scalars['Boolean']['output'];
  confirmAppointment: Appointment;
  createBlogPost: BlogPost;
  createBookingDraft: BookingDraftResult;
  createCatalogCategory: CatalogCategory;
  createCatalogCombo: CatalogCombo;
  createCloudinaryUploadSignature: CloudinaryUploadSignature;
  createGroupBooking: CreateGroupBookingResult;
  createLatenessExcuse: LatenessExcuse;
  createLocation: Location;
  createLocationBlackout: LocationBlackout;
  createOrder: Order;
  createOrderPaymentIntent: StripePaymentIntentResult;
  createPOSSale: Sale;
  createProduct: Product;
  createResource: Resource;
  createRole: Role;
  createService: Service;
  createShiftOverride: ShiftOverride;
  createStaff: StaffUser;
  createStaffMembership: StaffMembership;
  createStaffPhotoUploadSignature: CloudinaryUploadSignature;
  createStaffVacation: StaffVacation;
  createStockLocation: StockLocation;
  createStripePaymentIntent: StripePaymentIntentResult;
  createWalkIn: WalkIn;
  customerLogin: AuthResult;
  customerRegister: AuthResult;
  deactivateProduct: Product;
  deactivateService: Service;
  deactivateStaff: StaffUser;
  deleteBlogPost: Scalars['Boolean']['output'];
  deleteCatalogCategory: Scalars['Boolean']['output'];
  deleteCatalogCombo: Scalars['Boolean']['output'];
  deleteLatenessExcuse: Scalars['Boolean']['output'];
  deleteLatenessOverride: Scalars['Boolean']['output'];
  deleteLocationBlackout: Scalars['Boolean']['output'];
  deleteMetafieldValue: Scalars['Boolean']['output'];
  deleteRole: Scalars['Boolean']['output'];
  deleteService: Service;
  deleteShiftOverride: Scalars['Boolean']['output'];
  deleteStaffMembership: Scalars['Boolean']['output'];
  deleteStaffServicePrice: Scalars['Boolean']['output'];
  deleteStaffVacation: Scalars['Boolean']['output'];
  dropWalkIn: Scalars['Boolean']['output'];
  extendServiceTokenPrevious: ServiceTokenInfo;
  findOrCreateCustomer?: Maybe<Customer>;
  fulfillOrder: Order;
  inventoryAdjust: InventoryLevel;
  inventoryTransfer: Scalars['Boolean']['output'];
  logout: Scalars['Boolean']['output'];
  noShow: Appointment;
  openRegisterSession: RegisterSession;
  publishBlogPost: BlogPost;
  recalcReportingMetrics: Scalars['Boolean']['output'];
  refundApprove: Scalars['Boolean']['output'];
  refundReject: Scalars['Boolean']['output'];
  refundRequest: Scalars['String']['output'];
  removeProductImage: Product;
  reorderProductImages: Product;
  reorderWalkIn: Scalars['Boolean']['output'];
  replaceShiftTemplatesBatch: Array<ShiftTemplate>;
  replaceShiftTemplatesForWeek: Array<ShiftTemplate>;
  requestAppointmentManageLink: Scalars['String']['output'];
  rescheduleAppointment: RescheduleAppointmentResult;
  rescheduleAppointmentByToken: RescheduleAppointmentByTokenResult;
  resetLocationBusinessHours: Array<LocationBusinessHour>;
  resetPosPinAttempts: Scalars['Boolean']['output'];
  rotateServiceToken: RotateServiceTokenResult;
  runPayout: PayoutRun;
  setPosLocationPassword: Scalars['Boolean']['output'];
  setStaffPassword: Scalars['Boolean']['output'];
  setStaffPin: Scalars['Boolean']['output'];
  staffLogin: AuthResult;
  staffPinLogin: AuthResult;
  startService: Appointment;
  unassignRoleFromStaff: Scalars['Boolean']['output'];
  updateBlogPost: BlogPost;
  updateCatalogCategory: CatalogCategory;
  updateCatalogCombo: CatalogCombo;
  updateCustomerReputation: Customer;
  updateLocation: Location;
  updateLocationPolicy: LocationPolicy;
  updateProduct: Product;
  updateResource: Resource;
  updateRole: Role;
  updateService: Service;
  updateShiftOverride: ShiftOverride;
  updateStaff: StaffUser;
  updateStaffMembership: StaffMembership;
  updateStockLocation: StockLocation;
  upsertCatalogComboLocation: CatalogComboLocation;
  upsertLatenessOverride: LatenessOverride;
  upsertLatenessRule: LatenessRule;
  upsertLocationBusinessHour: LocationBusinessHour;
  upsertMetafieldDefinition: MetafieldDefinition;
  upsertMetafieldValue: MetafieldValue;
  upsertServiceLocation: ServiceLocation;
  upsertShiftTemplate: ShiftTemplate;
  upsertShiftTemplatesForWeek: Array<ShiftTemplate>;
  upsertStaffServicePrice: StaffServicePrice;
  verifyPosLocationAccess: Scalars['Boolean']['output'];
  voidSale: Sale;
};


export type MutationAddProductImageArgs = {
  productId: Scalars['ID']['input'];
  publicId: Scalars['String']['input'];
  url: Scalars['String']['input'];
};


export type MutationAssignPermissionsToRoleArgs = {
  permissionKeys: Array<Scalars['String']['input']>;
  roleId: Scalars['ID']['input'];
};


export type MutationAssignRoleToStaffArgs = {
  input: AssignRoleToStaffInput;
};


export type MutationAssignWalkInArgs = {
  staffUserId: Scalars['ID']['input'];
  walkInId: Scalars['ID']['input'];
};


export type MutationBulkAdjustPriceArgs = {
  deltaCents?: InputMaybe<Scalars['Int']['input']>;
  deltaPct?: InputMaybe<Scalars['Float']['input']>;
  ids: Array<Scalars['ID']['input']>;
};


export type MutationBulkAssignCategoryArgs = {
  categoryId: Scalars['ID']['input'];
  ids: Array<Scalars['ID']['input']>;
};


export type MutationBulkUpdateProductStatusArgs = {
  ids: Array<Scalars['ID']['input']>;
  status: ProductStatus;
};


export type MutationCancelAppointmentArgs = {
  appointmentId: Scalars['ID']['input'];
  overridePolicy?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationCancelAppointmentByTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationCancelOrderArgs = {
  orderId: Scalars['ID']['input'];
};


export type MutationCheckInArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type MutationClearStaffPinArgs = {
  staffUserId: Scalars['ID']['input'];
};


export type MutationClockInArgs = {
  locationId: Scalars['ID']['input'];
};


export type MutationClockOutArgs = {
  locationId: Scalars['ID']['input'];
};


export type MutationCloseRegisterSessionArgs = {
  input: CloseRegisterSessionInput;
};


export type MutationCompleteArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type MutationCompleteWalkInArgs = {
  walkInId: Scalars['ID']['input'];
};


export type MutationConfirmAppointmentArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type MutationCreateBlogPostArgs = {
  input: CreateBlogPostInput;
};


export type MutationCreateBookingDraftArgs = {
  input: CreateBookingDraftInput;
};


export type MutationCreateCatalogCategoryArgs = {
  input: CreateCatalogCategoryInput;
};


export type MutationCreateCatalogComboArgs = {
  input: CreateCatalogComboInput;
};


export type MutationCreateCloudinaryUploadSignatureArgs = {
  folder?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateGroupBookingArgs = {
  input: CreateGroupBookingInput;
};


export type MutationCreateLatenessExcuseArgs = {
  input: CreateLatenessExcuseInput;
};


export type MutationCreateLocationArgs = {
  input: CreateLocationInput;
};


export type MutationCreateLocationBlackoutArgs = {
  input: CreateLocationBlackoutInput;
};


export type MutationCreateOrderArgs = {
  input: CreateOrderInput;
};


export type MutationCreateOrderPaymentIntentArgs = {
  orderId: Scalars['ID']['input'];
};


export type MutationCreatePosSaleArgs = {
  input: CreatePosSaleInput;
};


export type MutationCreateProductArgs = {
  input: CreateProductInput;
};


export type MutationCreateResourceArgs = {
  input: CreateResourceInput;
  locationId: Scalars['ID']['input'];
};


export type MutationCreateRoleArgs = {
  input: CreateRoleInput;
};


export type MutationCreateServiceArgs = {
  input: CreateServiceInput;
};


export type MutationCreateShiftOverrideArgs = {
  input: CreateShiftOverrideInput;
};


export type MutationCreateStaffArgs = {
  input: CreateStaffInput;
};


export type MutationCreateStaffMembershipArgs = {
  input: CreateStaffMembershipInput;
};


export type MutationCreateStaffVacationArgs = {
  input: CreateStaffVacationInput;
};


export type MutationCreateStockLocationArgs = {
  input: CreateStockLocationInput;
};


export type MutationCreateStripePaymentIntentArgs = {
  saleId: Scalars['ID']['input'];
};


export type MutationCreateWalkInArgs = {
  customerEmail?: InputMaybe<Scalars['String']['input']>;
  customerId?: InputMaybe<Scalars['ID']['input']>;
  customerName?: InputMaybe<Scalars['String']['input']>;
  customerPhone?: InputMaybe<Scalars['String']['input']>;
  locationId: Scalars['ID']['input'];
};


export type MutationCustomerLoginArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationCustomerRegisterArgs = {
  input: CustomerRegisterInput;
};


export type MutationDeactivateProductArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeactivateServiceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeactivateStaffArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteBlogPostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCatalogCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCatalogComboArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteLatenessExcuseArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteLatenessOverrideArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteLocationBlackoutArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMetafieldValueArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRoleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteServiceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteShiftOverrideArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteStaffMembershipArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteStaffServicePriceArgs = {
  serviceId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type MutationDeleteStaffVacationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDropWalkInArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  walkInId: Scalars['ID']['input'];
};


export type MutationExtendServiceTokenPreviousArgs = {
  additionalHours: Scalars['Int']['input'];
};


export type MutationFindOrCreateCustomerArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
};


export type MutationFulfillOrderArgs = {
  orderId: Scalars['ID']['input'];
  stockLocationId: Scalars['ID']['input'];
};


export type MutationInventoryAdjustArgs = {
  delta: Scalars['Int']['input'];
  productId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  stockLocationId: Scalars['ID']['input'];
};


export type MutationInventoryTransferArgs = {
  fromStockLocationId: Scalars['ID']['input'];
  productId: Scalars['ID']['input'];
  qty: Scalars['Int']['input'];
  toStockLocationId: Scalars['ID']['input'];
};


export type MutationNoShowArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type MutationOpenRegisterSessionArgs = {
  openingCashCents?: InputMaybe<Scalars['Int']['input']>;
  registerId: Scalars['ID']['input'];
};


export type MutationPublishBlogPostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRecalcReportingMetricsArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
};


export type MutationRefundApproveArgs = {
  refundId: Scalars['ID']['input'];
};


export type MutationRefundRejectArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  refundId: Scalars['ID']['input'];
};


export type MutationRefundRequestArgs = {
  amountCents: Scalars['Int']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  saleId: Scalars['ID']['input'];
};


export type MutationRemoveProductImageArgs = {
  imageId: Scalars['ID']['input'];
  productId: Scalars['ID']['input'];
};


export type MutationReorderProductImagesArgs = {
  imageIdsInOrder: Array<Scalars['ID']['input']>;
  productId: Scalars['ID']['input'];
};


export type MutationReorderWalkInArgs = {
  afterWalkInId?: InputMaybe<Scalars['ID']['input']>;
  walkInId: Scalars['ID']['input'];
};


export type MutationReplaceShiftTemplatesBatchArgs = {
  input: ReplaceShiftTemplatesBatchInput;
};


export type MutationReplaceShiftTemplatesForWeekArgs = {
  input: ReplaceShiftTemplatesForWeekInput;
};


export type MutationRequestAppointmentManageLinkArgs = {
  appointmentId: Scalars['ID']['input'];
  email: Scalars['String']['input'];
};


export type MutationRescheduleAppointmentArgs = {
  appointmentId: Scalars['ID']['input'];
  newStartAt: Scalars['DateTime']['input'];
  overridePolicy?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationRescheduleAppointmentByTokenArgs = {
  newStartAt: Scalars['DateTime']['input'];
  token: Scalars['String']['input'];
};


export type MutationResetLocationBusinessHoursArgs = {
  locationId: Scalars['ID']['input'];
};


export type MutationResetPosPinAttemptsArgs = {
  staffUserId: Scalars['ID']['input'];
};


export type MutationRotateServiceTokenArgs = {
  input: RotateServiceTokenInput;
};


export type MutationRunPayoutArgs = {
  periodEnd: Scalars['DateTime']['input'];
  periodStart: Scalars['DateTime']['input'];
};


export type MutationSetPosLocationPasswordArgs = {
  locationId: Scalars['ID']['input'];
  password: Scalars['String']['input'];
};


export type MutationSetStaffPasswordArgs = {
  password: Scalars['String']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type MutationSetStaffPinArgs = {
  pin4: Scalars['String']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type MutationStaffLoginArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationStaffPinLoginArgs = {
  email: Scalars['String']['input'];
  pin4: Scalars['String']['input'];
};


export type MutationStartServiceArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type MutationUnassignRoleFromStaffArgs = {
  staffUserId: Scalars['ID']['input'];
};


export type MutationUpdateBlogPostArgs = {
  id: Scalars['ID']['input'];
  input: UpdateBlogPostInput;
};


export type MutationUpdateCatalogCategoryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCatalogCategoryInput;
};


export type MutationUpdateCatalogComboArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCatalogComboInput;
};


export type MutationUpdateCustomerReputationArgs = {
  customerId: Scalars['ID']['input'];
  reputationNote?: InputMaybe<Scalars['String']['input']>;
  reputationTag?: InputMaybe<CustomerReputationTag>;
};


export type MutationUpdateLocationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateLocationInput;
};


export type MutationUpdateLocationPolicyArgs = {
  input: UpdateLocationPolicyInput;
  locationId: Scalars['ID']['input'];
};


export type MutationUpdateProductArgs = {
  id: Scalars['ID']['input'];
  input: UpdateProductInput;
};


export type MutationUpdateResourceArgs = {
  id: Scalars['ID']['input'];
  input: UpdateResourceInput;
};


export type MutationUpdateRoleArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRoleInput;
};


export type MutationUpdateServiceArgs = {
  id: Scalars['ID']['input'];
  input: UpdateServiceInput;
};


export type MutationUpdateShiftOverrideArgs = {
  id: Scalars['ID']['input'];
  input: UpdateShiftOverrideInput;
};


export type MutationUpdateStaffArgs = {
  id: Scalars['ID']['input'];
  input: UpdateStaffInput;
};


export type MutationUpdateStaffMembershipArgs = {
  id: Scalars['ID']['input'];
  input?: InputMaybe<UpdateStaffMembershipInput>;
};


export type MutationUpdateStockLocationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateStockLocationInput;
};


export type MutationUpsertCatalogComboLocationArgs = {
  input: UpsertCatalogComboLocationInput;
};


export type MutationUpsertLatenessOverrideArgs = {
  input: UpsertLatenessOverrideInput;
};


export type MutationUpsertLatenessRuleArgs = {
  input: UpsertLatenessRuleInput;
  locationId: Scalars['ID']['input'];
};


export type MutationUpsertLocationBusinessHourArgs = {
  input: UpsertLocationBusinessHourInput;
};


export type MutationUpsertMetafieldDefinitionArgs = {
  input: UpsertMetafieldDefinitionInput;
};


export type MutationUpsertMetafieldValueArgs = {
  input: UpsertMetafieldValueInput;
};


export type MutationUpsertServiceLocationArgs = {
  input: UpsertServiceLocationInput;
};


export type MutationUpsertShiftTemplateArgs = {
  input: UpsertShiftTemplateInput;
};


export type MutationUpsertShiftTemplatesForWeekArgs = {
  input: UpsertShiftTemplatesForWeekInput;
};


export type MutationUpsertStaffServicePriceArgs = {
  input: UpsertStaffServicePriceInput;
};


export type MutationVerifyPosLocationAccessArgs = {
  locationId: Scalars['ID']['input'];
  password: Scalars['String']['input'];
};


export type MutationVoidSaleArgs = {
  saleId: Scalars['ID']['input'];
};

export type Order = {
  __typename?: 'Order';
  createdAt: Scalars['DateTime']['output'];
  customer?: Maybe<Customer>;
  customerId?: Maybe<Scalars['ID']['output']>;
  fulfillmentStatus?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  items: Array<OrderItem>;
  pickupLocation?: Maybe<Location>;
  pickupLocationId?: Maybe<Scalars['ID']['output']>;
  shippingAddress?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  status: Scalars['String']['output'];
  totalCents: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type OrderItem = {
  __typename?: 'OrderItem';
  id: Scalars['ID']['output'];
  product?: Maybe<Product>;
  productId: Scalars['ID']['output'];
  qty: Scalars['Int']['output'];
  unitPriceCents: Scalars['Int']['output'];
  variant?: Maybe<ProductVariant>;
  variantId?: Maybe<Scalars['ID']['output']>;
};

export type PosSaleItemInput = {
  catalogComboId?: InputMaybe<Scalars['ID']['input']>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  qty: Scalars['Int']['input'];
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  unitPriceCents: Scalars['Int']['input'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PayoutRun = {
  __typename?: 'PayoutRun';
  entries: Array<PayoutRunEntry>;
  id: Scalars['ID']['output'];
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  status: Scalars['String']['output'];
  totalsJson?: Maybe<Scalars['JSON']['output']>;
};

export type PayoutRunEntry = {
  __typename?: 'PayoutRunEntry';
  amountCents: Scalars['Int']['output'];
  breakdownJson?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  staffUserId: Scalars['ID']['output'];
};

export type PosCajaStatusHome = {
  __typename?: 'PosCajaStatusHome';
  accumulatedCents?: Maybe<Scalars['Int']['output']>;
  isOpen: Scalars['Boolean']['output'];
  openedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type PosPinLockoutStatus = {
  __typename?: 'PosPinLockoutStatus';
  /** Remaining attempts before next lockout. 8 if not in failure state. */
  attemptsRemaining: Scalars['Int']['output'];
  /** Null if not currently locked. */
  lockedUntil?: Maybe<Scalars['DateTime']['output']>;
};

export type PosPublicLocation = {
  __typename?: 'PosPublicLocation';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Product = {
  __typename?: 'Product';
  categoryId?: Maybe<Scalars['ID']['output']>;
  commissionCents?: Maybe<Scalars['Int']['output']>;
  compareAtPriceCents?: Maybe<Scalars['Int']['output']>;
  costCents?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  handle?: Maybe<Scalars['String']['output']>;
  heightMm?: Maybe<Scalars['Int']['output']>;
  hsCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imagePublicId?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  images: Array<ProductImage>;
  isActive: Scalars['Boolean']['output'];
  lengthMm?: Maybe<Scalars['Int']['output']>;
  locationIds: Array<Scalars['ID']['output']>;
  metafields: Array<MetafieldValue>;
  name: Scalars['String']['output'];
  penaltyCommissionCents?: Maybe<Scalars['Int']['output']>;
  productType?: Maybe<Scalars['String']['output']>;
  requiresShipping: Scalars['Boolean']['output'];
  seoDescription?: Maybe<Scalars['String']['output']>;
  seoTitle?: Maybe<Scalars['String']['output']>;
  sku?: Maybe<Scalars['String']['output']>;
  status: ProductStatus;
  tags: Array<Scalars['String']['output']>;
  taxCode?: Maybe<Scalars['String']['output']>;
  taxable: Scalars['Boolean']['output'];
  variants: Array<ProductVariant>;
  vendor?: Maybe<Scalars['String']['output']>;
  weightGrams?: Maybe<Scalars['Int']['output']>;
  widthMm?: Maybe<Scalars['Int']['output']>;
};

export type ProductConnection = {
  __typename?: 'ProductConnection';
  edges: Array<ProductEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ProductEdge = {
  __typename?: 'ProductEdge';
  cursor: Scalars['String']['output'];
  node: Product;
};

export type ProductImage = {
  __typename?: 'ProductImage';
  id: Scalars['ID']['output'];
  publicId: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  url: Scalars['String']['output'];
};

export enum ProductStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Draft = 'DRAFT'
}

export type ProductVariant = {
  __typename?: 'ProductVariant';
  barcode?: Maybe<Scalars['String']['output']>;
  compareAtPriceCents?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  metafields: Array<MetafieldValue>;
  name: Scalars['String']['output'];
  option1?: Maybe<Scalars['String']['output']>;
  option2?: Maybe<Scalars['String']['output']>;
  option3?: Maybe<Scalars['String']['output']>;
  priceCents: Scalars['Int']['output'];
  sku?: Maybe<Scalars['String']['output']>;
};

export enum ProductsSort {
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  PriceAsc = 'PRICE_ASC',
  PriceDesc = 'PRICE_DESC',
  UpdatedAsc = 'UPDATED_ASC',
  UpdatedDesc = 'UPDATED_DESC'
}

export type Query = {
  __typename?: 'Query';
  activeServiceTokens: Array<ServiceTokenInfo>;
  alertsFeed: Array<DashboardAlert>;
  appointment?: Maybe<Appointment>;
  appointments: Array<Appointment>;
  availableSlots: Array<Scalars['DateTime']['output']>;
  barbers: Array<StaffUser>;
  blogPost?: Maybe<BlogPost>;
  blogPostBySlug?: Maybe<BlogPost>;
  blogPosts: Array<BlogPost>;
  catalogCategories: Array<CatalogCategory>;
  catalogCategory?: Maybe<CatalogCategory>;
  catalogCombo?: Maybe<CatalogCombo>;
  catalogCombos: Array<CatalogCombo>;
  cloudinaryConfig: CloudinaryConfig;
  customer?: Maybe<Customer>;
  customerAppointments: Array<Appointment>;
  customers: Array<Customer>;
  customersCount: Scalars['Int']['output'];
  dailyLocationMetrics: Array<DailyLocationMetrics>;
  dailyStaffMetrics: Array<DailyStaffMetrics>;
  dashboardSummary: DashboardSummary;
  inventoryLevels: Array<InventoryLevel>;
  latenessExcuses: Array<LatenessExcuse>;
  latenessOverrides: Array<LatenessOverride>;
  latenessRule?: Maybe<LatenessRule>;
  listAppointmentsForKPI: Array<Appointment>;
  listInventoryAlerts: Array<InventoryAlertRow>;
  listSalesForKPI: Array<Sale>;
  liveAgenda: Array<Appointment>;
  location?: Maybe<Location>;
  locationBlackouts: Array<LocationBlackout>;
  locationBusinessHours: Array<LocationBusinessHour>;
  locationShiftTemplates: Array<ShiftTemplate>;
  locations: Array<Location>;
  messageLogs: Array<MessageLog>;
  messageTemplates: Array<MessageTemplate>;
  metafieldDefinitions: Array<MetafieldDefinition>;
  metafieldValues: Array<MetafieldValue>;
  order?: Maybe<Order>;
  orders: Array<Order>;
  payoutRun?: Maybe<PayoutRun>;
  payoutRuns: Array<PayoutRun>;
  permissions: Array<Scalars['String']['output']>;
  posCajaStatusHome: PosCajaStatusHome;
  posInventoryLevels: Array<InventoryLevel>;
  posPinLockoutStatus: PosPinLockoutStatus;
  posPublicLocations: Array<PosPublicLocation>;
  product?: Maybe<Product>;
  products: Array<Product>;
  productsPaged: ProductConnection;
  realtimeBranchStatus: Array<RealtimeBranchStatusRow>;
  refunds: RefundConnection;
  registerSession?: Maybe<RegisterSession>;
  registerSessions: RegisterSessionConnection;
  registers: Array<Register>;
  reportByDayOfWeek: Array<ReportDayOfWeekRow>;
  reportCompareLocations: Array<ReportCompareLocationRow>;
  reportCompareTwoDays: ReportCompareTwoDays;
  reportHeatmapByHour: Array<ReportHeatmapCell>;
  reportMonthOverMonth: ReportMonthOverMonth;
  reportNoShowRate: ReportNoShowRate;
  reportRefunds: ReportRefunds;
  reportRevenueMix: Array<ReportRevenueMixRow>;
  reportStaffPerformance: Array<ReportStaffPerformanceRow>;
  reportWeekOverWeek: ReportWeekOverWeek;
  reportsExportCsv: Scalars['String']['output'];
  role?: Maybe<Role>;
  roles: Array<Role>;
  searchCustomers: Array<Customer>;
  service?: Maybe<Service>;
  serviceDistribution: Array<ServiceDistributionRow>;
  services: Array<Service>;
  shiftOverrides: Array<ShiftOverride>;
  shiftTemplates: Array<ShiftTemplate>;
  staff?: Maybe<StaffUser>;
  staffCommissionToday: Scalars['Int']['output'];
  staffList: Array<StaffUser>;
  staffLocationsWithSchedules: Array<StaffLocationScheduleSummary>;
  staffMemberships: Array<StaffMembership>;
  staffProductRevenueToday: Scalars['Int']['output'];
  staffRevenueToday: Scalars['Int']['output'];
  staffRoleAssignments: Array<StaffRoleAssignmentRow>;
  staffServiceRevenueToday: Scalars['Int']['output'];
  staffShiftOverridesAllLocations: Array<ShiftOverride>;
  staffShiftTemplatesAllLocations: Array<ShiftTemplate>;
  staffVacations: Array<StaffVacation>;
  stockLocation?: Maybe<StockLocation>;
  stockLocations: Array<StockLocation>;
  timeClockEvents: Array<TimeClockEvent>;
  viewer: Viewer;
  walkIns: Array<WalkIn>;
};


export type QueryAlertsFeedArgs = {
  filters: DashboardFiltersInput;
};


export type QueryAppointmentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAppointmentsArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<AppointmentStatus>;
};


export type QueryAvailableSlotsArgs = {
  input: AvailableSlotsInput;
};


export type QueryBarbersArgs = {
  locationId: Scalars['ID']['input'];
};


export type QueryBlogPostArgs = {
  id: Scalars['ID']['input'];
};


export type QueryBlogPostBySlugArgs = {
  slug: Scalars['String']['input'];
};


export type QueryBlogPostsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  publishedOnly?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCatalogCategoriesArgs = {
  appliesTo?: InputMaybe<CategoryAppliesTo>;
};


export type QueryCatalogCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCatalogComboArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCatalogCombosArgs = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCustomerArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCustomerAppointmentsArgs = {
  customerId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCustomersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCustomersCountArgs = {
  query?: InputMaybe<Scalars['String']['input']>;
};


export type QueryDailyLocationMetricsArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryDailyStaffMetricsArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryDashboardSummaryArgs = {
  filters: DashboardFiltersInput;
};


export type QueryInventoryLevelsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  stockLocationId: Scalars['ID']['input'];
};


export type QueryLatenessExcusesArgs = {
  fromDate: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
  toDate: Scalars['String']['input'];
};


export type QueryLatenessOverridesArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryLatenessRuleArgs = {
  locationId: Scalars['ID']['input'];
};


export type QueryListAppointmentsForKpiArgs = {
  date: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  status?: InputMaybe<AppointmentStatus>;
};


export type QueryListInventoryAlertsArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryListSalesForKpiArgs = {
  date: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  source?: InputMaybe<SaleSource>;
};


export type QueryLiveAgendaArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  locationId?: InputMaybe<Scalars['ID']['input']>;
  windowMinutes?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLocationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryLocationBlackoutsArgs = {
  fromDate?: InputMaybe<Scalars['String']['input']>;
  locationId: Scalars['ID']['input'];
  toDate?: InputMaybe<Scalars['String']['input']>;
};


export type QueryLocationBusinessHoursArgs = {
  locationId: Scalars['ID']['input'];
};


export type QueryLocationShiftTemplatesArgs = {
  locationId: Scalars['ID']['input'];
};


export type QueryLocationsArgs = {
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryMessageLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMetafieldValuesArgs = {
  ownerId: Scalars['ID']['input'];
  ownerType: MetafieldOwnerType;
};


export type QueryOrderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOrdersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPayoutRunArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPayoutRunsArgs = {
  periodEnd?: InputMaybe<Scalars['DateTime']['input']>;
  periodStart?: InputMaybe<Scalars['DateTime']['input']>;
};


export type QueryPosCajaStatusHomeArgs = {
  locationId: Scalars['ID']['input'];
};


export type QueryPosInventoryLevelsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  locationId: Scalars['ID']['input'];
};


export type QueryPosPinLockoutStatusArgs = {
  email: Scalars['String']['input'];
};


export type QueryProductArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProductsArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryProductsPagedArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  categoryId?: InputMaybe<Scalars['String']['input']>;
  first?: Scalars['Int']['input'];
  search?: InputMaybe<Scalars['String']['input']>;
  sort?: ProductsSort;
  status?: InputMaybe<ProductStatus>;
};


export type QueryRealtimeBranchStatusArgs = {
  filters: DashboardFiltersInput;
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryRefundsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: Scalars['Int']['input'];
  locationId: Scalars['ID']['input'];
  status?: InputMaybe<RefundStatus>;
};


export type QueryRegisterSessionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRegisterSessionsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  first?: Scalars['Int']['input'];
  locationId: Scalars['ID']['input'];
  status?: InputMaybe<RegisterSessionStatus>;
};


export type QueryRegistersArgs = {
  locationId: Scalars['ID']['input'];
};


export type QueryReportByDayOfWeekArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportCompareLocationsArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportCompareTwoDaysArgs = {
  dateA: Scalars['String']['input'];
  dateB: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportHeatmapByHourArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportMonthOverMonthArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
  month: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
};


export type QueryReportNoShowRateArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportRefundsArgs = {
  byDay?: InputMaybe<Scalars['Boolean']['input']>;
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportRevenueMixArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportStaffPerformanceArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportWeekOverWeekArgs = {
  dateFrom: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryReportsExportCsvArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  type: Scalars['String']['input'];
};


export type QueryRoleArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySearchCustomersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};


export type QueryServiceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryServiceDistributionArgs = {
  filters: DashboardFiltersInput;
};


export type QueryServicesArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryShiftOverridesArgs = {
  fromDate: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  toDate: Scalars['String']['input'];
};


export type QueryShiftTemplatesArgs = {
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type QueryStaffArgs = {
  id: Scalars['ID']['input'];
};


export type QueryStaffCommissionTodayArgs = {
  date: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type QueryStaffLocationsWithSchedulesArgs = {
  staffUserId: Scalars['ID']['input'];
};


export type QueryStaffMembershipsArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryStaffProductRevenueTodayArgs = {
  date: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type QueryStaffRevenueTodayArgs = {
  date: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type QueryStaffRoleAssignmentsArgs = {
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryStaffServiceRevenueTodayArgs = {
  date: Scalars['String']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};


export type QueryStaffShiftOverridesAllLocationsArgs = {
  fromDate: Scalars['String']['input'];
  locationIds: Array<Scalars['ID']['input']>;
  staffUserIds: Array<Scalars['ID']['input']>;
  toDate: Scalars['String']['input'];
};


export type QueryStaffShiftTemplatesAllLocationsArgs = {
  locationIds: Array<Scalars['ID']['input']>;
  staffUserIds: Array<Scalars['ID']['input']>;
};


export type QueryStaffVacationsArgs = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryStockLocationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTimeClockEventsArgs = {
  fromDate: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
  staffUserId: Scalars['ID']['input'];
  toDate: Scalars['String']['input'];
};


export type QueryWalkInsArgs = {
  locationId: Scalars['ID']['input'];
};

export type RealtimeBranchStatusRow = {
  __typename?: 'RealtimeBranchStatusRow';
  barbersOnDuty: Array<BarberOnDuty>;
  inServiceCount: Scalars['Int']['output'];
  locationId: Scalars['ID']['output'];
  locationName: Scalars['String']['output'];
  /** Horario de operación hoy (minutos desde medianoche). Null si no hay staff con turno. */
  operatingHoursEndMin?: Maybe<Scalars['Int']['output']>;
  /** Horario de operación hoy (minutos desde medianoche). Null si no hay staff con turno. */
  operatingHoursStartMin?: Maybe<Scalars['Int']['output']>;
  registerOpen: Scalars['Boolean']['output'];
  reservableChairStatus?: Maybe<Scalars['String']['output']>;
  waitingCount: Scalars['Int']['output'];
};

export type Refund = {
  __typename?: 'Refund';
  amountCents: Scalars['Int']['output'];
  approvedAt?: Maybe<Scalars['DateTime']['output']>;
  approvedByStaffUserId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  requestedAt: Scalars['DateTime']['output'];
  requestedByStaffUserId?: Maybe<Scalars['ID']['output']>;
  sale: Sale;
  saleId: Scalars['ID']['output'];
  status: RefundStatus;
};

export type RefundConnection = {
  __typename?: 'RefundConnection';
  edges: Array<RefundEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type RefundEdge = {
  __typename?: 'RefundEdge';
  cursor: Scalars['String']['output'];
  node: Refund;
};

export enum RefundStatus {
  Approved = 'APPROVED',
  Completed = 'COMPLETED',
  Rejected = 'REJECTED',
  Requested = 'REQUESTED'
}

export type Register = {
  __typename?: 'Register';
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  locationId: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  openSession?: Maybe<RegisterSession>;
};

export type RegisterSession = {
  __typename?: 'RegisterSession';
  closedAt?: Maybe<Scalars['DateTime']['output']>;
  countedCardCents?: Maybe<Scalars['Int']['output']>;
  countedCashCents?: Maybe<Scalars['Int']['output']>;
  countedTransferCents?: Maybe<Scalars['Int']['output']>;
  expectedCardCents: Scalars['Int']['output'];
  expectedCashCents: Scalars['Int']['output'];
  expectedTransferCents: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  openedAt: Scalars['DateTime']['output'];
  status: RegisterSessionStatus;
};

export type RegisterSessionConnection = {
  __typename?: 'RegisterSessionConnection';
  edges: Array<RegisterSessionEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type RegisterSessionEdge = {
  __typename?: 'RegisterSessionEdge';
  cursor: Scalars['String']['output'];
  node: RegisterSession;
};

export enum RegisterSessionStatus {
  Closed = 'CLOSED',
  Open = 'OPEN'
}

export type ReplaceShiftTemplatesBatchInput = {
  days: Array<ShiftTemplateDayInput>;
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};

export type ReplaceShiftTemplatesForWeekInput = {
  blocks?: InputMaybe<Array<ShiftBlockInput>>;
  dayOfWeeks: Array<Scalars['Int']['input']>;
  endMin: Scalars['Int']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
  startMin: Scalars['Int']['input'];
};

export type ReportCompareLocationRow = {
  __typename?: 'ReportCompareLocationRow';
  appointmentCount: Scalars['Int']['output'];
  locationId: Scalars['ID']['output'];
  noShowCount: Scalars['Int']['output'];
  percentOfTotalRevenue: Scalars['Float']['output'];
  rank: Scalars['Int']['output'];
  refundCents: Scalars['Int']['output'];
  revenuePosCents: Scalars['Int']['output'];
  revenuePrepayCents: Scalars['Int']['output'];
  totalRevenueCents: Scalars['Int']['output'];
};

export type ReportCompareTwoDays = {
  __typename?: 'ReportCompareTwoDays';
  dateA: ReportSingleDay;
  dateB: ReportSingleDay;
  delta: ReportPeriodTotals;
};

export type ReportDayOfWeekRow = {
  __typename?: 'ReportDayOfWeekRow';
  appointmentCount: Scalars['Int']['output'];
  dayOfWeek: Scalars['Int']['output'];
  noShowCount: Scalars['Int']['output'];
  refundCents: Scalars['Int']['output'];
  revenueCents: Scalars['Int']['output'];
};

export type ReportHeatmapCell = {
  __typename?: 'ReportHeatmapCell';
  appointmentCount: Scalars['Int']['output'];
  dayOfWeek: Scalars['Int']['output'];
  hour: Scalars['Int']['output'];
  locationId: Scalars['ID']['output'];
  revenueCents: Scalars['Int']['output'];
};

export type ReportMonthOverMonth = {
  __typename?: 'ReportMonthOverMonth';
  currentMonth: ReportPeriodTotals;
  delta: ReportPeriodTotals;
  pctChange: ReportPeriodTotals;
  previousMonth: ReportPeriodTotals;
};

export type ReportNoShowRate = {
  __typename?: 'ReportNoShowRate';
  noShowCount: Scalars['Int']['output'];
  ratePercent: Scalars['Float']['output'];
  totalAppointments: Scalars['Int']['output'];
};

export type ReportPeriodTotals = {
  __typename?: 'ReportPeriodTotals';
  appointmentCount: Scalars['Int']['output'];
  noShowCount: Scalars['Int']['output'];
  refundCents: Scalars['Int']['output'];
  revenueCents: Scalars['Int']['output'];
};

export type ReportRefunds = {
  __typename?: 'ReportRefunds';
  byDay?: Maybe<Array<ReportRefundsByDay>>;
  refundCount: Scalars['Int']['output'];
  totalRefundCents: Scalars['Int']['output'];
};

export type ReportRefundsByDay = {
  __typename?: 'ReportRefundsByDay';
  date: Scalars['String']['output'];
  refundCents: Scalars['Int']['output'];
  refundCount: Scalars['Int']['output'];
};

export type ReportRevenueMixRow = {
  __typename?: 'ReportRevenueMixRow';
  locationId: Scalars['ID']['output'];
  posPercent: Scalars['Float']['output'];
  prepayPercent: Scalars['Float']['output'];
  totalCents: Scalars['Int']['output'];
  totalPosCents: Scalars['Int']['output'];
  totalPrepayCents: Scalars['Int']['output'];
};

export type ReportSingleDay = {
  __typename?: 'ReportSingleDay';
  appointmentCount: Scalars['Int']['output'];
  date: Scalars['String']['output'];
  noShowCount: Scalars['Int']['output'];
  refundCents: Scalars['Int']['output'];
  revenueCents: Scalars['Int']['output'];
};

export type ReportStaffPerformanceRow = {
  __typename?: 'ReportStaffPerformanceRow';
  locationId: Scalars['ID']['output'];
  rank: Scalars['Int']['output'];
  revenueCents: Scalars['Int']['output'];
  staffName?: Maybe<Scalars['String']['output']>;
  staffUserId: Scalars['ID']['output'];
};

export type ReportWeekOverWeek = {
  __typename?: 'ReportWeekOverWeek';
  currentWeek: ReportPeriodTotals;
  delta: ReportPeriodTotals;
  pctChange: ReportPeriodTotals;
  previousWeek: ReportPeriodTotals;
};

export type RescheduleAppointmentByTokenResult = {
  __typename?: 'RescheduleAppointmentByTokenResult';
  appointment?: Maybe<Appointment>;
  ok: Scalars['Boolean']['output'];
};

export type RescheduleAppointmentResult = {
  __typename?: 'RescheduleAppointmentResult';
  appointment?: Maybe<Appointment>;
  ok: Scalars['Boolean']['output'];
};

export type ResolvedExtra = {
  __typename?: 'ResolvedExtra';
  commissionCents?: Maybe<Scalars['Int']['output']>;
  durationMin: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  priceCents: Scalars['Int']['output'];
  serviceId: Scalars['ID']['output'];
};

export type ResolvedServicePricing = {
  __typename?: 'ResolvedServicePricing';
  commissionCents?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  durationMin: Scalars['Int']['output'];
  extras: Array<ResolvedExtra>;
  isActive: Scalars['Boolean']['output'];
  locationId: Scalars['ID']['output'];
  priceCents: Scalars['Int']['output'];
  priceFromLocationOverride: Scalars['Boolean']['output'];
  priceFromStaffOverride: Scalars['Boolean']['output'];
  serviceId: Scalars['ID']['output'];
  staffUserId?: Maybe<Scalars['ID']['output']>;
  totalDurationMin: Scalars['Int']['output'];
  totalPriceCents: Scalars['Int']['output'];
};

export type Resource = {
  __typename?: 'Resource';
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isReservable: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
};

export type Role = {
  __typename?: 'Role';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  permissionKeys: Array<Scalars['String']['output']>;
};

export type RotateServiceTokenInput = {
  /** TTL for the outgoing PREVIOUS slot, in hours. Default 168 (7 days). Range: 1–720. */
  previousTtlHours?: InputMaybe<Scalars['Int']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type RotateServiceTokenResult = {
  __typename?: 'RotateServiceTokenResult';
  currentToken: ServiceTokenInfo;
  plaintext: Scalars['String']['output'];
  previousRetireAt?: Maybe<Scalars['DateTime']['output']>;
  previousToken?: Maybe<ServiceTokenInfo>;
};

export type Sale = {
  __typename?: 'Sale';
  appointmentId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  customer?: Maybe<Customer>;
  id: Scalars['ID']['output'];
  paidTotalCents: Scalars['Int']['output'];
  paymentStatus: SalePaymentStatus;
  source: Scalars['String']['output'];
  status: SaleStatus;
  subtotalCents: Scalars['Int']['output'];
  taxTotalCents: Scalars['Int']['output'];
  totalCents: Scalars['Int']['output'];
  walkInId?: Maybe<Scalars['ID']['output']>;
};

export enum SalePaymentStatus {
  Paid = 'PAID',
  PartiallyPaid = 'PARTIALLY_PAID',
  Refunded = 'REFUNDED',
  Unpaid = 'UNPAID'
}

export enum SaleSource {
  AdminAdjustment = 'ADMIN_ADJUSTMENT',
  BookingNoPay = 'BOOKING_NO_PAY',
  OnlinePrepay = 'ONLINE_PREPAY',
  Pos = 'POS'
}

export enum SaleStatus {
  Open = 'OPEN',
  Paid = 'PAID',
  Refunded = 'REFUNDED',
  Void = 'VOID'
}

export enum ScopeType {
  Global = 'GLOBAL',
  Location = 'LOCATION',
  Self = 'SELF'
}

export type Service = {
  __typename?: 'Service';
  baseDurationMin: Scalars['Int']['output'];
  basePriceCents: Scalars['Int']['output'];
  categoryId?: Maybe<Scalars['ID']['output']>;
  commissionCents?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imagePublicId?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  isActive: Scalars['Boolean']['output'];
  isAddOn: Scalars['Boolean']['output'];
  locationIds: Array<Scalars['ID']['output']>;
  locations: Array<ServiceLocation>;
  name: Scalars['String']['output'];
  penaltyCommissionCents?: Maybe<Scalars['Int']['output']>;
  pricingFor: ResolvedServicePricing;
  staffOverrides: Array<StaffServicePrice>;
};


export type ServicePricingForArgs = {
  locationId: Scalars['ID']['input'];
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
};

export type ServiceDistributionRow = {
  __typename?: 'ServiceDistributionRow';
  count: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  percentage: Scalars['Float']['output'];
};

export type ServiceLocation = {
  __typename?: 'ServiceLocation';
  commissionCentsOverride?: Maybe<Scalars['Int']['output']>;
  descriptionOverride?: Maybe<Scalars['String']['output']>;
  durationMinOverride?: Maybe<Scalars['Int']['output']>;
  extraServiceIds: Array<Scalars['ID']['output']>;
  isActive: Scalars['Boolean']['output'];
  locationId: Scalars['ID']['output'];
  priceCentsOverride?: Maybe<Scalars['Int']['output']>;
  serviceId: Scalars['ID']['output'];
};

export type ServiceTokenInfo = {
  __typename?: 'ServiceTokenInfo';
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  promotedAt?: Maybe<Scalars['DateTime']['output']>;
  retireAt?: Maybe<Scalars['DateTime']['output']>;
  slot: TokenSlot;
};

export type ShiftBlock = {
  __typename?: 'ShiftBlock';
  endMin: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  startMin: Scalars['Int']['output'];
  type: ShiftBlockType;
};

export type ShiftBlockInput = {
  endMin: Scalars['Int']['input'];
  startMin: Scalars['Int']['input'];
  type: ShiftBlockType;
};

export enum ShiftBlockType {
  Break = 'BREAK',
  Lunch = 'LUNCH'
}

export type ShiftOverride = {
  __typename?: 'ShiftOverride';
  blocks?: Maybe<Array<ShiftOverrideBlock>>;
  date: Scalars['DateTime']['output'];
  endMin?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  locationId: Scalars['ID']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  staffUserId: Scalars['ID']['output'];
  startMin?: Maybe<Scalars['Int']['output']>;
  type: ShiftOverrideType;
};

export type ShiftOverrideBlock = {
  __typename?: 'ShiftOverrideBlock';
  endMin: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  startMin: Scalars['Int']['output'];
  type: ShiftBlockType;
};

export enum ShiftOverrideType {
  CustomHours = 'CUSTOM_HOURS',
  DayOff = 'DAY_OFF'
}

export type ShiftTemplate = {
  __typename?: 'ShiftTemplate';
  blocks: Array<ShiftBlock>;
  dayOfWeek: Scalars['Int']['output'];
  endMin: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  locationId: Scalars['ID']['output'];
  staffUserId: Scalars['ID']['output'];
  startMin: Scalars['Int']['output'];
};

export type ShiftTemplateDayInput = {
  blocks?: InputMaybe<Array<ShiftBlockInput>>;
  dayOfWeek: Scalars['Int']['input'];
  endMin: Scalars['Int']['input'];
  startMin: Scalars['Int']['input'];
};

export enum StaffContextRole {
  Admin = 'ADMIN',
  Barber = 'BARBER',
  Frontdesk = 'FRONTDESK',
  Manager = 'MANAGER'
}

export type StaffLocationScheduleSummary = {
  __typename?: 'StaffLocationScheduleSummary';
  locationId: Scalars['ID']['output'];
  locationName: Scalars['String']['output'];
  templateCount: Scalars['Int']['output'];
};

export type StaffMembership = {
  __typename?: 'StaffMembership';
  contextRole: StaffContextRole;
  endsAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  location: Location;
  locationId: Scalars['ID']['output'];
  staffUser: StaffUser;
  staffUserId: Scalars['ID']['output'];
  startsAt: Scalars['DateTime']['output'];
};

export type StaffRoleAssignmentRow = {
  __typename?: 'StaffRoleAssignmentRow';
  id: Scalars['ID']['output'];
  locationId?: Maybe<Scalars['ID']['output']>;
  roleId: Scalars['ID']['output'];
  roleName: Scalars['String']['output'];
  scopeType: ScopeType;
  staffUserId: Scalars['ID']['output'];
};

export type StaffServicePrice = {
  __typename?: 'StaffServicePrice';
  commissionCentsOverride?: Maybe<Scalars['Int']['output']>;
  priceCents: Scalars['Int']['output'];
  serviceId: Scalars['ID']['output'];
  staffUserId: Scalars['ID']['output'];
};

export type StaffUser = {
  __typename?: 'StaffUser';
  email: Scalars['String']['output'];
  fullName: Scalars['String']['output'];
  hasPosPin: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  phone?: Maybe<Scalars['String']['output']>;
  photoPublicId?: Maybe<Scalars['String']['output']>;
  photoUrl?: Maybe<Scalars['String']['output']>;
  pinAttempts: Scalars['Int']['output'];
  pinLockedUntil?: Maybe<Scalars['DateTime']['output']>;
};

export type StaffVacation = {
  __typename?: 'StaffVacation';
  createdAt: Scalars['DateTime']['output'];
  endDate: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  locationId: Scalars['ID']['output'];
  staffUserId: Scalars['ID']['output'];
  startDate: Scalars['String']['output'];
};

export type StockLocation = {
  __typename?: 'StockLocation';
  id: Scalars['ID']['output'];
  locationId?: Maybe<Scalars['ID']['output']>;
  name: Scalars['String']['output'];
  type: StockLocationType;
};

export enum StockLocationType {
  Store = 'STORE',
  Warehouse = 'WAREHOUSE'
}

export type StripePaymentIntentResult = {
  __typename?: 'StripePaymentIntentResult';
  amountCents: Scalars['Int']['output'];
  clientSecret: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  paymentIntentId: Scalars['String']['output'];
  provider: Scalars['String']['output'];
};

export type TimeClockEvent = {
  __typename?: 'TimeClockEvent';
  at: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  locationId: Scalars['ID']['output'];
  staffUserId: Scalars['ID']['output'];
  type: TimeClockEventType;
};

export enum TimeClockEventType {
  ClockIn = 'CLOCK_IN',
  ClockOut = 'CLOCK_OUT'
}

export enum TokenSlot {
  Current = 'CURRENT',
  Previous = 'PREVIOUS'
}

export type UpdateBlogPostInput = {
  contentJson?: InputMaybe<Scalars['JSON']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCatalogCategoryInput = {
  appliesTo?: InputMaybe<CategoryAppliesTo>;
  description?: InputMaybe<Scalars['String']['input']>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateCatalogComboInput = {
  commissionCents?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  extraCategoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  items?: InputMaybe<Array<CatalogComboItemInput>>;
  name?: InputMaybe<Scalars['String']['input']>;
  penaltyCommissionCents?: InputMaybe<Scalars['Int']['input']>;
  priceCents?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateLocationInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  photoPublicId?: InputMaybe<Scalars['String']['input']>;
  photoUrl?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateLocationPolicyInput = {
  bookingBufferAfterMin?: InputMaybe<Scalars['Int']['input']>;
  bookingBufferBeforeMin?: InputMaybe<Scalars['Int']['input']>;
  bookingPaymentMode?: InputMaybe<BookingPaymentMode>;
  cancellationWindowMinutes?: InputMaybe<Scalars['Int']['input']>;
  depositAmountCents?: InputMaybe<Scalars['Int']['input']>;
  depositMaxCents?: InputMaybe<Scalars['Int']['input']>;
  depositMinCents?: InputMaybe<Scalars['Int']['input']>;
  depositPercentBps?: InputMaybe<Scalars['Int']['input']>;
  depositType?: InputMaybe<DepositType>;
  holdDurationMinutes?: InputMaybe<Scalars['Int']['input']>;
  lateBufferMinutes?: InputMaybe<Scalars['Int']['input']>;
  minBookingLeadMinutes?: InputMaybe<Scalars['Int']['input']>;
  walkinBlockWithinMinutes?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateProductInput = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  commissionCents?: InputMaybe<Scalars['Int']['input']>;
  compareAtPriceCents?: InputMaybe<Scalars['Int']['input']>;
  costCents?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  handle?: InputMaybe<Scalars['String']['input']>;
  heightMm?: InputMaybe<Scalars['Int']['input']>;
  hsCode?: InputMaybe<Scalars['String']['input']>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  lengthMm?: InputMaybe<Scalars['Int']['input']>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  name?: InputMaybe<Scalars['String']['input']>;
  penaltyCommissionCents?: InputMaybe<Scalars['Int']['input']>;
  productType?: InputMaybe<Scalars['String']['input']>;
  requiresShipping?: InputMaybe<Scalars['Boolean']['input']>;
  seoDescription?: InputMaybe<Scalars['String']['input']>;
  seoTitle?: InputMaybe<Scalars['String']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProductStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  taxCode?: InputMaybe<Scalars['String']['input']>;
  taxable?: InputMaybe<Scalars['Boolean']['input']>;
  variants?: InputMaybe<Array<CreateProductVariantInput>>;
  vendor?: InputMaybe<Scalars['String']['input']>;
  weightGrams?: InputMaybe<Scalars['Int']['input']>;
  widthMm?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateResourceInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isReservable?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRoleInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateServiceInput = {
  baseDurationMin?: InputMaybe<Scalars['Int']['input']>;
  basePriceCents?: InputMaybe<Scalars['Int']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  commissionCents?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  imagePublicId?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isAddOn?: InputMaybe<Scalars['Boolean']['input']>;
  locationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  name?: InputMaybe<Scalars['String']['input']>;
  penaltyCommissionCents?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateShiftOverrideInput = {
  blocks?: InputMaybe<Array<ShiftBlockInput>>;
  endMin?: InputMaybe<Scalars['Int']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  startMin?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateStaffInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  fullName?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  photoPublicId?: InputMaybe<Scalars['String']['input']>;
  photoUrl?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateStaffMembershipInput = {
  contextRole?: InputMaybe<StaffContextRole>;
  endsAt?: InputMaybe<Scalars['DateTime']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  locationId?: InputMaybe<Scalars['ID']['input']>;
  startsAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpdateStockLocationInput = {
  locationId?: InputMaybe<Scalars['ID']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<StockLocationType>;
};

export type UpsertCatalogComboLocationInput = {
  comboId: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  locationId: Scalars['ID']['input'];
  priceCentsOverride?: InputMaybe<Scalars['Int']['input']>;
};

export type UpsertLatenessOverrideInput = {
  effectiveFrom?: InputMaybe<Scalars['String']['input']>;
  effectiveTo?: InputMaybe<Scalars['String']['input']>;
  locationId?: InputMaybe<Scalars['ID']['input']>;
  minutesLateThreshold?: InputMaybe<Scalars['Int']['input']>;
  staffUserId: Scalars['ID']['input'];
};

export type UpsertLatenessRuleInput = {
  defaultMinutesLateThreshold: Scalars['Int']['input'];
};

export type UpsertLocationBusinessHourInput = {
  closeMin: Scalars['Int']['input'];
  dayIndex: Scalars['Int']['input'];
  isOpen: Scalars['Boolean']['input'];
  locationId: Scalars['ID']['input'];
  openMin: Scalars['Int']['input'];
};

export type UpsertMetafieldDefinitionInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  key: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  namespace: Scalars['String']['input'];
  type: Scalars['String']['input'];
};

export type UpsertMetafieldValueInput = {
  key: Scalars['String']['input'];
  namespace: Scalars['String']['input'];
  ownerId: Scalars['ID']['input'];
  ownerType: MetafieldOwnerType;
  type: Scalars['String']['input'];
  value?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpsertServiceLocationInput = {
  commissionCentsOverride?: InputMaybe<Scalars['Int']['input']>;
  descriptionOverride?: InputMaybe<Scalars['String']['input']>;
  durationMinOverride?: InputMaybe<Scalars['Int']['input']>;
  extraServiceIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  locationId: Scalars['ID']['input'];
  priceCentsOverride?: InputMaybe<Scalars['Int']['input']>;
  serviceId: Scalars['ID']['input'];
};

export type UpsertShiftTemplateInput = {
  blocks?: InputMaybe<Array<ShiftBlockInput>>;
  dayOfWeek: Scalars['Int']['input'];
  endMin: Scalars['Int']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
  startMin: Scalars['Int']['input'];
};

export type UpsertShiftTemplatesForWeekInput = {
  blocks?: InputMaybe<Array<ShiftBlockInput>>;
  endMin: Scalars['Int']['input'];
  locationId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
  startMin: Scalars['Int']['input'];
};

export type UpsertStaffServicePriceInput = {
  commissionCentsOverride?: InputMaybe<Scalars['Int']['input']>;
  priceCents: Scalars['Int']['input'];
  serviceId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
};

export type Viewer = {
  __typename?: 'Viewer';
  customer?: Maybe<Customer>;
  kind: ViewerKind;
  locationScopes: Array<ViewerLocationScope>;
  permissions: Array<Scalars['String']['output']>;
  staff?: Maybe<StaffUser>;
};

export enum ViewerKind {
  Anon = 'ANON',
  Customer = 'CUSTOMER',
  Staff = 'STAFF'
}

export type ViewerLocationScope = {
  __typename?: 'ViewerLocationScope';
  locationId?: Maybe<Scalars['ID']['output']>;
  scopeType: ScopeType;
};

export type WalkIn = {
  __typename?: 'WalkIn';
  assignedStaffUser?: Maybe<StaffUser>;
  createdAt: Scalars['DateTime']['output'];
  customer?: Maybe<Customer>;
  customerEmail?: Maybe<Scalars['String']['output']>;
  customerName?: Maybe<Scalars['String']['output']>;
  customerPhone?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  status: WalkInStatus;
};

export enum WalkInStatus {
  Assigned = 'ASSIGNED',
  Cancelled = 'CANCELLED',
  Done = 'DONE',
  Pending = 'PENDING'
}

export type PosViewerQueryVariables = Exact<{ [key: string]: never; }>;


export type PosViewerQuery = { __typename?: 'Query', viewer: { __typename?: 'Viewer', kind: ViewerKind, permissions: Array<string>, staff?: { __typename?: 'StaffUser', id: string, fullName: string, email: string, phone?: string | null, photoUrl?: string | null, isActive: boolean, hasPosPin: boolean, pinAttempts: number, pinLockedUntil?: any | null } | null, locationScopes: Array<{ __typename?: 'ViewerLocationScope', scopeType: ScopeType, locationId?: string | null }> } };

export type PosPublicLocationsQueryVariables = Exact<{ [key: string]: never; }>;


export type PosPublicLocationsQuery = { __typename?: 'Query', posPublicLocations: Array<{ __typename?: 'PosPublicLocation', id: string, name: string }> };

export type VerifyPosLocationAccessMutationVariables = Exact<{
  locationId: Scalars['ID']['input'];
  password: Scalars['String']['input'];
}>;


export type VerifyPosLocationAccessMutation = { __typename?: 'Mutation', verifyPosLocationAccess: boolean };

export type StaffPinLoginMutationVariables = Exact<{
  email: Scalars['String']['input'];
  pin4: Scalars['String']['input'];
}>;


export type StaffPinLoginMutation = { __typename?: 'Mutation', staffPinLogin: { __typename?: 'AuthResult', viewer: { __typename?: 'Viewer', kind: ViewerKind, permissions: Array<string>, staff?: { __typename?: 'StaffUser', id: string, fullName: string, email: string, phone?: string | null, photoUrl?: string | null, isActive: boolean, hasPosPin: boolean, pinAttempts: number, pinLockedUntil?: any | null } | null, locationScopes: Array<{ __typename?: 'ViewerLocationScope', scopeType: ScopeType, locationId?: string | null }> } } };

export type PosBarbersQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type PosBarbersQuery = { __typename?: 'Query', barbers: Array<{ __typename?: 'StaffUser', id: string, fullName: string, email: string, phone?: string | null, photoUrl?: string | null, isActive: boolean, hasPosPin: boolean, pinAttempts: number, pinLockedUntil?: any | null }> };

export type PosPinLockoutStatusQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type PosPinLockoutStatusQuery = { __typename?: 'Query', posPinLockoutStatus: { __typename?: 'PosPinLockoutStatus', lockedUntil?: any | null, attemptsRemaining: number } };

export type PosLogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type PosLogoutMutation = { __typename?: 'Mutation', logout: boolean };

export type PosAppointmentsQueryVariables = Exact<{
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  locationId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<AppointmentStatus>;
}>;


export type PosAppointmentsQuery = { __typename?: 'Query', appointments: Array<{ __typename?: 'Appointment', id: string, status: AppointmentStatus, salePaymentStatus?: SalePaymentStatus | null, startAt: any, endAt: any, totalCents: number, locationId?: string | null, locationName?: string | null, customer?: { __typename?: 'Customer', id: string, fullName: string, phone?: string | null } | null, staffUser?: { __typename?: 'StaffUser', id: string, fullName: string } | null, items: Array<{ __typename?: 'AppointmentItem', label: string, serviceId?: string | null, qty: number, unitPriceCents: number }> }> };

export type CheckInMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type CheckInMutation = { __typename?: 'Mutation', checkIn: { __typename?: 'Appointment', id: string, status: AppointmentStatus } };

export type StartServiceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type StartServiceMutation = { __typename?: 'Mutation', startService: { __typename?: 'Appointment', id: string, status: AppointmentStatus } };

export type CompleteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type CompleteMutation = { __typename?: 'Mutation', complete: { __typename?: 'Appointment', id: string, status: AppointmentStatus } };

export type NoShowMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type NoShowMutation = { __typename?: 'Mutation', noShow: { __typename?: 'Appointment', id: string, status: AppointmentStatus } };

export type PosCatalogCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type PosCatalogCategoriesQuery = { __typename?: 'Query', catalogCategories: Array<{ __typename?: 'CatalogCategory', id: string, name: string, slug: string, sortOrder: number, appliesTo: CategoryAppliesTo }> };

export type PosServicesQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
  staffUserId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type PosServicesQuery = { __typename?: 'Query', services: Array<{ __typename?: 'Service', id: string, name: string, basePriceCents: number, baseDurationMin: number, isActive: boolean, isAddOn: boolean, imageUrl?: string | null, categoryId?: string | null, pricingFor: { __typename?: 'ResolvedServicePricing', priceCents: number, durationMin: number, extras: Array<{ __typename?: 'ResolvedExtra', serviceId: string, name: string, priceCents: number, durationMin: number }> } }> };

export type PosProductsQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type PosProductsQuery = { __typename?: 'Query', products: Array<{ __typename?: 'Product', id: string, name: string, sku?: string | null, imageUrl?: string | null, categoryId?: string | null, isActive: boolean, variants: Array<{ __typename?: 'ProductVariant', id: string, priceCents: number }> }> };

export type PosInventoryLevelsQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type PosInventoryLevelsQuery = { __typename?: 'Query', posInventoryLevels: Array<{ __typename?: 'InventoryLevel', productId: string, quantity: number }> };

export type PosCatalogCombosQueryVariables = Exact<{ [key: string]: never; }>;


export type PosCatalogCombosQuery = { __typename?: 'Query', catalogCombos: Array<{ __typename?: 'CatalogCombo', id: string, name: string, priceCents: number, imageUrl?: string | null, effectiveCategoryIds: Array<string>, items: Array<{ __typename?: 'CatalogComboItem', serviceId?: string | null, productId?: string | null, serviceName?: string | null, productName?: string | null, qty: number, sortOrder: number }> }> };

export type PosSearchCustomersQueryVariables = Exact<{
  query: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type PosSearchCustomersQuery = { __typename?: 'Query', searchCustomers: Array<{ __typename?: 'Customer', id: string, fullName: string, email?: string | null, phone?: string | null }> };

export type FindOrCreateCustomerMutationVariables = Exact<{
  name: Scalars['String']['input'];
  email?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
}>;


export type FindOrCreateCustomerMutation = { __typename?: 'Mutation', findOrCreateCustomer?: { __typename?: 'Customer', id: string, fullName: string, email?: string | null, phone?: string | null } | null };

export type CreatePosSaleMutationVariables = Exact<{
  input: CreatePosSaleInput;
}>;


export type CreatePosSaleMutation = { __typename?: 'Mutation', createPOSSale: { __typename?: 'Sale', id: string, status: SaleStatus, paymentStatus: SalePaymentStatus, totalCents: number, paidTotalCents: number } };

export type ClockInMutationVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type ClockInMutation = { __typename?: 'Mutation', clockIn: boolean };

export type ClockOutMutationVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type ClockOutMutation = { __typename?: 'Mutation', clockOut: boolean };

export type TimeClockEventsQueryVariables = Exact<{
  staffUserId: Scalars['ID']['input'];
  locationId: Scalars['ID']['input'];
  fromDate: Scalars['String']['input'];
  toDate: Scalars['String']['input'];
}>;


export type TimeClockEventsQuery = { __typename?: 'Query', timeClockEvents: Array<{ __typename?: 'TimeClockEvent', id: string, type: TimeClockEventType, at: any }> };

export type ShiftTemplatesQueryVariables = Exact<{
  staffUserId: Scalars['ID']['input'];
  locationId: Scalars['ID']['input'];
}>;


export type ShiftTemplatesQuery = { __typename?: 'Query', shiftTemplates: Array<{ __typename?: 'ShiftTemplate', id: string, staffUserId: string, locationId: string, dayOfWeek: number, startMin: number, endMin: number }> };

export type PosHomeCommissionQueryVariables = Exact<{
  staffUserId: Scalars['ID']['input'];
  locationId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type PosHomeCommissionQuery = { __typename?: 'Query', staffServiceRevenueToday: number, staffProductRevenueToday: number, staffCommissionToday: number };

export type PosHomeCajaStatusQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type PosHomeCajaStatusQuery = { __typename?: 'Query', posCajaStatusHome: { __typename?: 'PosCajaStatusHome', isOpen: boolean, accumulatedCents?: number | null, openedAt?: any | null } };

export type PosStaffMetricsTodayQueryVariables = Exact<{
  staffUserId: Scalars['ID']['input'];
  locationId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type PosStaffMetricsTodayQuery = { __typename?: 'Query', staffServiceRevenueToday: number, staffProductRevenueToday: number, staffCommissionToday: number };

export type PosSalesActivityQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
  source?: InputMaybe<SaleSource>;
}>;


export type PosSalesActivityQuery = { __typename?: 'Query', listSalesForKPI: Array<{ __typename?: 'Sale', id: string, status: SaleStatus, paymentStatus: SalePaymentStatus, totalCents: number, createdAt: any, appointmentId?: string | null, walkInId?: string | null, customer?: { __typename?: 'Customer', id: string, fullName: string, email?: string | null, phone?: string | null } | null }> };

export type PosRegistersQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type PosRegistersQuery = { __typename?: 'Query', registers: Array<{ __typename?: 'Register', id: string, name: string, isActive: boolean, locationId: string, openSession?: { __typename?: 'RegisterSession', id: string, status: RegisterSessionStatus, openedAt: any, expectedCashCents: number, expectedCardCents: number, expectedTransferCents: number } | null }> };

export type OpenRegisterSessionMutationVariables = Exact<{
  registerId: Scalars['ID']['input'];
  openingCashCents?: InputMaybe<Scalars['Int']['input']>;
}>;


export type OpenRegisterSessionMutation = { __typename?: 'Mutation', openRegisterSession: { __typename?: 'RegisterSession', id: string, status: RegisterSessionStatus, openedAt: any, expectedCashCents: number, expectedCardCents: number, expectedTransferCents: number } };

export type CloseRegisterSessionMutationVariables = Exact<{
  input: CloseRegisterSessionInput;
}>;


export type CloseRegisterSessionMutation = { __typename?: 'Mutation', closeRegisterSession: { __typename?: 'RegisterSession', id: string, status: RegisterSessionStatus, closedAt?: any | null, countedCashCents?: number | null, countedCardCents?: number | null, countedTransferCents?: number | null, expectedCashCents: number, expectedCardCents: number, expectedTransferCents: number } };

export type PosWalkInsQueryVariables = Exact<{
  locationId: Scalars['ID']['input'];
}>;


export type PosWalkInsQuery = { __typename?: 'Query', walkIns: Array<{ __typename?: 'WalkIn', id: string, status: WalkInStatus, customerName?: string | null, customerPhone?: string | null, customerEmail?: string | null, createdAt: any, assignedStaffUser?: { __typename?: 'StaffUser', id: string, fullName: string } | null, customer?: { __typename?: 'Customer', id: string, fullName: string, email?: string | null, phone?: string | null } | null }> };

export type CreateWalkInMutationVariables = Exact<{
  locationId: Scalars['ID']['input'];
  customerName?: InputMaybe<Scalars['String']['input']>;
  customerPhone?: InputMaybe<Scalars['String']['input']>;
  customerEmail?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateWalkInMutation = { __typename?: 'Mutation', createWalkIn: { __typename?: 'WalkIn', id: string, status: WalkInStatus, customerName?: string | null, customerPhone?: string | null, customerEmail?: string | null, createdAt: any } };

export type AssignWalkInMutationVariables = Exact<{
  walkInId: Scalars['ID']['input'];
  staffUserId: Scalars['ID']['input'];
}>;


export type AssignWalkInMutation = { __typename?: 'Mutation', assignWalkIn: { __typename?: 'AssignWalkInResult', warning?: string | null, walkIn: { __typename?: 'WalkIn', id: string, status: WalkInStatus, assignedStaffUser?: { __typename?: 'StaffUser', id: string, fullName: string } | null } } };

export type CompleteWalkInMutationVariables = Exact<{
  walkInId: Scalars['ID']['input'];
}>;


export type CompleteWalkInMutation = { __typename?: 'Mutation', completeWalkIn: boolean };

export type DropWalkInMutationVariables = Exact<{
  walkInId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
}>;


export type DropWalkInMutation = { __typename?: 'Mutation', dropWalkIn: boolean };


export const PosViewerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosViewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"staff"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"hasPosPin"}},{"kind":"Field","name":{"kind":"Name","value":"pinAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"pinLockedUntil"}}]}},{"kind":"Field","name":{"kind":"Name","value":"permissions"}},{"kind":"Field","name":{"kind":"Name","value":"locationScopes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scopeType"}},{"kind":"Field","name":{"kind":"Name","value":"locationId"}}]}}]}}]}}]} as unknown as DocumentNode<PosViewerQuery, PosViewerQueryVariables>;
export const PosPublicLocationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosPublicLocations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"posPublicLocations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<PosPublicLocationsQuery, PosPublicLocationsQueryVariables>;
export const VerifyPosLocationAccessDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyPosLocationAccess"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyPosLocationAccess"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<VerifyPosLocationAccessMutation, VerifyPosLocationAccessMutationVariables>;
export const StaffPinLoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StaffPinLogin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin4"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"staffPinLogin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"pin4"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin4"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"staff"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"hasPosPin"}},{"kind":"Field","name":{"kind":"Name","value":"pinAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"pinLockedUntil"}}]}},{"kind":"Field","name":{"kind":"Name","value":"permissions"}},{"kind":"Field","name":{"kind":"Name","value":"locationScopes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scopeType"}},{"kind":"Field","name":{"kind":"Name","value":"locationId"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StaffPinLoginMutation, StaffPinLoginMutationVariables>;
export const PosBarbersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosBarbers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"barbers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"hasPosPin"}},{"kind":"Field","name":{"kind":"Name","value":"pinAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"pinLockedUntil"}}]}}]}}]} as unknown as DocumentNode<PosBarbersQuery, PosBarbersQueryVariables>;
export const PosPinLockoutStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosPinLockoutStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"posPinLockoutStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lockedUntil"}},{"kind":"Field","name":{"kind":"Name","value":"attemptsRemaining"}}]}}]}}]} as unknown as DocumentNode<PosPinLockoutStatusQuery, PosPinLockoutStatusQueryVariables>;
export const PosLogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PosLogout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"}}]}}]} as unknown as DocumentNode<PosLogoutMutation, PosLogoutMutationVariables>;
export const PosAppointmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosAppointments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dateFrom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dateTo"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AppointmentStatus"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appointments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"dateFrom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dateFrom"}}},{"kind":"Argument","name":{"kind":"Name","value":"dateTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dateTo"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"salePaymentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"totalCents"}},{"kind":"Field","name":{"kind":"Name","value":"customer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}}]}},{"kind":"Field","name":{"kind":"Name","value":"staffUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"serviceId"}},{"kind":"Field","name":{"kind":"Name","value":"qty"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCents"}}]}},{"kind":"Field","name":{"kind":"Name","value":"locationId"}},{"kind":"Field","name":{"kind":"Name","value":"locationName"}}]}}]}}]} as unknown as DocumentNode<PosAppointmentsQuery, PosAppointmentsQueryVariables>;
export const CheckInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CheckIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkIn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<CheckInMutation, CheckInMutationVariables>;
export const StartServiceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartService"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startService"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<StartServiceMutation, StartServiceMutationVariables>;
export const CompleteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Complete"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"complete"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<CompleteMutation, CompleteMutationVariables>;
export const NoShowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"NoShow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"noShow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<NoShowMutation, NoShowMutationVariables>;
export const PosCatalogCategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosCatalogCategories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"catalogCategories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"appliesTo"}}]}}]}}]} as unknown as DocumentNode<PosCatalogCategoriesQuery, PosCatalogCategoriesQueryVariables>;
export const PosServicesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosServices"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"services"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"basePriceCents"}},{"kind":"Field","name":{"kind":"Name","value":"baseDurationMin"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"isAddOn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"pricingFor"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"priceCents"}},{"kind":"Field","name":{"kind":"Name","value":"durationMin"}},{"kind":"Field","name":{"kind":"Name","value":"extras"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"serviceId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"priceCents"}},{"kind":"Field","name":{"kind":"Name","value":"durationMin"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PosServicesQuery, PosServicesQueryVariables>;
export const PosProductsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosProducts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"products"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"sku"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"variants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"priceCents"}}]}}]}}]}}]} as unknown as DocumentNode<PosProductsQuery, PosProductsQueryVariables>;
export const PosInventoryLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosInventoryLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"posInventoryLevels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}}]}}]}}]} as unknown as DocumentNode<PosInventoryLevelsQuery, PosInventoryLevelsQueryVariables>;
export const PosCatalogCombosDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosCatalogCombos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"catalogCombos"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activeOnly"},"value":{"kind":"BooleanValue","value":true}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"priceCents"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveCategoryIds"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"serviceId"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"serviceName"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"qty"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]}}]} as unknown as DocumentNode<PosCatalogCombosQuery, PosCatalogCombosQueryVariables>;
export const PosSearchCustomersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosSearchCustomers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchCustomers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}}]}}]}}]} as unknown as DocumentNode<PosSearchCustomersQuery, PosSearchCustomersQueryVariables>;
export const FindOrCreateCustomerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FindOrCreateCustomer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"phone"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"findOrCreateCustomer"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"phone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"phone"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}}]}}]}}]} as unknown as DocumentNode<FindOrCreateCustomerMutation, FindOrCreateCustomerMutationVariables>;
export const CreatePosSaleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreatePosSale"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreatePOSSaleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPOSSale"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"paymentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"totalCents"}},{"kind":"Field","name":{"kind":"Name","value":"paidTotalCents"}}]}}]}}]} as unknown as DocumentNode<CreatePosSaleMutation, CreatePosSaleMutationVariables>;
export const ClockInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ClockIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clockIn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}]}]}}]} as unknown as DocumentNode<ClockInMutation, ClockInMutationVariables>;
export const ClockOutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ClockOut"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clockOut"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}]}]}}]} as unknown as DocumentNode<ClockOutMutation, ClockOutMutationVariables>;
export const TimeClockEventsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TimeClockEvents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fromDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"timeClockEvents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"fromDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fromDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"toDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toDate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}}]} as unknown as DocumentNode<TimeClockEventsQuery, TimeClockEventsQueryVariables>;
export const ShiftTemplatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ShiftTemplates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shiftTemplates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"staffUserId"}},{"kind":"Field","name":{"kind":"Name","value":"locationId"}},{"kind":"Field","name":{"kind":"Name","value":"dayOfWeek"}},{"kind":"Field","name":{"kind":"Name","value":"startMin"}},{"kind":"Field","name":{"kind":"Name","value":"endMin"}}]}}]}}]} as unknown as DocumentNode<ShiftTemplatesQuery, ShiftTemplatesQueryVariables>;
export const PosHomeCommissionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosHomeCommission"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"date"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"staffServiceRevenueToday"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}}]},{"kind":"Field","name":{"kind":"Name","value":"staffProductRevenueToday"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}}]},{"kind":"Field","name":{"kind":"Name","value":"staffCommissionToday"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}}]}]}}]} as unknown as DocumentNode<PosHomeCommissionQuery, PosHomeCommissionQueryVariables>;
export const PosHomeCajaStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosHomeCajaStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"posCajaStatusHome"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isOpen"}},{"kind":"Field","name":{"kind":"Name","value":"accumulatedCents"}},{"kind":"Field","name":{"kind":"Name","value":"openedAt"}}]}}]}}]} as unknown as DocumentNode<PosHomeCajaStatusQuery, PosHomeCajaStatusQueryVariables>;
export const PosStaffMetricsTodayDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosStaffMetricsToday"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"date"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"staffServiceRevenueToday"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}}]},{"kind":"Field","name":{"kind":"Name","value":"staffProductRevenueToday"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}}]},{"kind":"Field","name":{"kind":"Name","value":"staffCommissionToday"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}},{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}}]}]}}]} as unknown as DocumentNode<PosStaffMetricsTodayQuery, PosStaffMetricsTodayQueryVariables>;
export const PosSalesActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosSalesActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"date"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"source"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SaleSource"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"listSalesForKPI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}},{"kind":"Argument","name":{"kind":"Name","value":"source"},"value":{"kind":"Variable","name":{"kind":"Name","value":"source"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"paymentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"totalCents"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"appointmentId"}},{"kind":"Field","name":{"kind":"Name","value":"walkInId"}},{"kind":"Field","name":{"kind":"Name","value":"customer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}}]}}]}}]}}]} as unknown as DocumentNode<PosSalesActivityQuery, PosSalesActivityQueryVariables>;
export const PosRegistersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosRegisters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"locationId"}},{"kind":"Field","name":{"kind":"Name","value":"openSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"openedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expectedCashCents"}},{"kind":"Field","name":{"kind":"Name","value":"expectedCardCents"}},{"kind":"Field","name":{"kind":"Name","value":"expectedTransferCents"}}]}}]}}]}}]} as unknown as DocumentNode<PosRegistersQuery, PosRegistersQueryVariables>;
export const OpenRegisterSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"OpenRegisterSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"registerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"openingCashCents"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"openRegisterSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"registerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"registerId"}}},{"kind":"Argument","name":{"kind":"Name","value":"openingCashCents"},"value":{"kind":"Variable","name":{"kind":"Name","value":"openingCashCents"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"openedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expectedCashCents"}},{"kind":"Field","name":{"kind":"Name","value":"expectedCardCents"}},{"kind":"Field","name":{"kind":"Name","value":"expectedTransferCents"}}]}}]}}]} as unknown as DocumentNode<OpenRegisterSessionMutation, OpenRegisterSessionMutationVariables>;
export const CloseRegisterSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CloseRegisterSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CloseRegisterSessionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"closeRegisterSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"countedCashCents"}},{"kind":"Field","name":{"kind":"Name","value":"countedCardCents"}},{"kind":"Field","name":{"kind":"Name","value":"countedTransferCents"}},{"kind":"Field","name":{"kind":"Name","value":"expectedCashCents"}},{"kind":"Field","name":{"kind":"Name","value":"expectedCardCents"}},{"kind":"Field","name":{"kind":"Name","value":"expectedTransferCents"}}]}}]}}]} as unknown as DocumentNode<CloseRegisterSessionMutation, CloseRegisterSessionMutationVariables>;
export const PosWalkInsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PosWalkIns"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"walkIns"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"customerName"}},{"kind":"Field","name":{"kind":"Name","value":"customerPhone"}},{"kind":"Field","name":{"kind":"Name","value":"customerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"assignedStaffUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"customer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}}]}}]}}]}}]} as unknown as DocumentNode<PosWalkInsQuery, PosWalkInsQueryVariables>;
export const CreateWalkInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWalkIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"customerName"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"customerPhone"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"customerEmail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createWalkIn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"customerName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"customerName"}}},{"kind":"Argument","name":{"kind":"Name","value":"customerPhone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"customerPhone"}}},{"kind":"Argument","name":{"kind":"Name","value":"customerEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"customerEmail"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"customerName"}},{"kind":"Field","name":{"kind":"Name","value":"customerPhone"}},{"kind":"Field","name":{"kind":"Name","value":"customerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateWalkInMutation, CreateWalkInMutationVariables>;
export const AssignWalkInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AssignWalkIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"walkInId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignWalkIn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"walkInId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"walkInId"}}},{"kind":"Argument","name":{"kind":"Name","value":"staffUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffUserId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"walkIn"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"assignedStaffUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"warning"}}]}}]}}]} as unknown as DocumentNode<AssignWalkInMutation, AssignWalkInMutationVariables>;
export const CompleteWalkInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteWalkIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"walkInId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeWalkIn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"walkInId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"walkInId"}}}]}]}}]} as unknown as DocumentNode<CompleteWalkInMutation, CompleteWalkInMutationVariables>;
export const DropWalkInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DropWalkIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"walkInId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reason"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dropWalkIn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"walkInId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"walkInId"}}},{"kind":"Argument","name":{"kind":"Name","value":"reason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reason"}}}]}]}}]} as unknown as DocumentNode<DropWalkInMutation, DropWalkInMutationVariables>;