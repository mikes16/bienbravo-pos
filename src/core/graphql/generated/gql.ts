/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query PosViewer {\n    viewer {\n      kind\n      staff {\n        id fullName email phone photoUrl isActive hasPosPin\n        pinAttempts pinLockedUntil\n      }\n      permissions\n      locationScopes { scopeType locationId }\n    }\n  }\n": typeof types.PosViewerDocument,
    "\n  query PosPublicLocations {\n    posPublicLocations {\n      id\n      name\n    }\n  }\n": typeof types.PosPublicLocationsDocument,
    "\n  mutation VerifyPosLocationAccess($locationId: ID!, $password: String!) {\n    verifyPosLocationAccess(locationId: $locationId, password: $password)\n  }\n": typeof types.VerifyPosLocationAccessDocument,
    "\n  mutation StaffPinLogin($email: String!, $pin4: String!) {\n    staffPinLogin(email: $email, pin4: $pin4) {\n      viewer {\n        kind\n        staff {\n          id fullName email phone photoUrl isActive hasPosPin\n          pinAttempts pinLockedUntil\n        }\n        permissions\n        locationScopes { scopeType locationId }\n      }\n    }\n  }\n": typeof types.StaffPinLoginDocument,
    "\n  query PosBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id fullName email phone photoUrl isActive hasPosPin\n      pinAttempts pinLockedUntil\n    }\n  }\n": typeof types.PosBarbersDocument,
    "\n  query PosPinLockoutStatus($email: String!) {\n    posPinLockoutStatus(email: $email) {\n      lockedUntil\n      attemptsRemaining\n    }\n  }\n": typeof types.PosPinLockoutStatusDocument,
    "\n  mutation PosLogout { logout }\n": typeof types.PosLogoutDocument,
    "\n  query PosAppointments($dateFrom: String!, $dateTo: String!, $locationId: ID, $status: AppointmentStatus) {\n    appointments(dateFrom: $dateFrom, dateTo: $dateTo, locationId: $locationId, status: $status) {\n      id status salePaymentStatus startAt endAt totalCents\n      customer { id fullName phone }\n      staffUser { id fullName }\n      items { label serviceId qty unitPriceCents }\n      locationId locationName\n    }\n  }\n": typeof types.PosAppointmentsDocument,
    "mutation CheckIn($id: ID!) { checkIn(appointmentId: $id) { id status } }": typeof types.CheckInDocument,
    "mutation StartService($id: ID!) { startService(appointmentId: $id) { id status } }": typeof types.StartServiceDocument,
    "mutation Complete($id: ID!) { complete(appointmentId: $id) { id status } }": typeof types.CompleteDocument,
    "mutation NoShow($id: ID!) { noShow(appointmentId: $id) { id status } }": typeof types.NoShowDocument,
    "\n  mutation PosFindOrCreateMostradorCustomer {\n    findOrCreateMostradorCustomer {\n      id\n      fullName\n    }\n  }\n": typeof types.PosFindOrCreateMostradorCustomerDocument,
    "\n  query PosCheckoutBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id\n      fullName\n      photoUrl\n    }\n  }\n": typeof types.PosCheckoutBarbersDocument,
    "\n  query PosCustomer($id: ID!) {\n    customer(id: $id) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n": typeof types.PosCustomerDocument,
    "\n  query PosWalkInsForLookup($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id\n      status\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n": typeof types.PosWalkInsForLookupDocument,
    "\n  query PosCatalogCategories {\n    catalogCategories {\n      id\n      name\n      slug\n      sortOrder\n      appliesTo\n    }\n  }\n": typeof types.PosCatalogCategoriesDocument,
    "\n  query PosServices($locationId: ID!, $staffUserId: ID) {\n    services(locationId: $locationId) {\n      id\n      name\n      basePriceCents\n      baseDurationMin\n      isActive\n      isAddOn\n      imageUrl\n      categoryId\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n        durationMin\n        extras {\n          serviceId\n          name\n          priceCents\n          durationMin\n        }\n      }\n    }\n  }\n": typeof types.PosServicesDocument,
    "\n  query PosResolveServicePrice($id: ID!, $locationId: ID!, $staffUserId: ID) {\n    service(id: $id) {\n      id\n      basePriceCents\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n      }\n    }\n  }\n": typeof types.PosResolveServicePriceDocument,
    "\n  query PosCustomerHistory($customerId: ID!, $limit: Int) {\n    customerAppointments(customerId: $customerId, limit: $limit) {\n      id\n      status\n      startAt\n      items { label }\n    }\n  }\n": typeof types.PosCustomerHistoryDocument,
    "\n  query PosProducts($locationId: ID!) {\n    products(locationId: $locationId) {\n      id\n      name\n      sku\n      imageUrl\n      categoryId\n      isActive\n      variants {\n        id\n        priceCents\n      }\n    }\n  }\n": typeof types.PosProductsDocument,
    "\n  query PosInventoryLevels($locationId: ID!) {\n    posInventoryLevels(locationId: $locationId) {\n      productId\n      quantity\n    }\n  }\n": typeof types.PosInventoryLevelsDocument,
    "\n  query PosCatalogCombos {\n    catalogCombos(activeOnly: true) {\n      id\n      name\n      priceCents\n      imageUrl\n      effectiveCategoryIds\n      items {\n        serviceId\n        productId\n        serviceName\n        productName\n        qty\n        sortOrder\n      }\n    }\n  }\n": typeof types.PosCatalogCombosDocument,
    "\n  query PosSearchCustomers($query: String!, $limit: Int) {\n    searchCustomers(query: $query, limit: $limit) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n": typeof types.PosSearchCustomersDocument,
    "\n  mutation FindOrCreateCustomer($name: String!, $email: String, $phone: String) {\n    findOrCreateCustomer(name: $name, email: $email, phone: $phone) {\n      id fullName email phone\n    }\n  }\n": typeof types.FindOrCreateCustomerDocument,
    "\n  mutation CreatePosSale($input: CreatePOSSaleInput!) {\n    createPOSSale(input: $input) {\n      id\n      status\n      paymentStatus\n      totalCents\n      paidTotalCents\n    }\n  }\n": typeof types.CreatePosSaleDocument,
    "\n  mutation ClockIn($locationId: ID!) { clockIn(locationId: $locationId) }\n": typeof types.ClockInDocument,
    "\n  mutation ClockOut($locationId: ID!) { clockOut(locationId: $locationId) }\n": typeof types.ClockOutDocument,
    "\n  query TimeClockEvents($staffUserId: ID!, $locationId: ID!, $fromDate: String!, $toDate: String!) {\n    timeClockEvents(staffUserId: $staffUserId, locationId: $locationId, fromDate: $fromDate, toDate: $toDate) {\n      id type at\n    }\n  }\n": typeof types.TimeClockEventsDocument,
    "\n  query ShiftTemplates($staffUserId: ID!, $locationId: ID!) {\n    shiftTemplates(staffUserId: $staffUserId, locationId: $locationId) {\n      id staffUserId locationId dayOfWeek startMin endMin\n    }\n  }\n": typeof types.ShiftTemplatesDocument,
    "\n  query PosHomeCommission($staffUserId: ID!, $locationId: ID!, $date: String!) {\n    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n  }\n": typeof types.PosHomeCommissionDocument,
    "\n  query PosHomeCajaStatus($locationId: ID!) {\n    posCajaStatusHome(locationId: $locationId) {\n      isOpen\n      accumulatedCents\n      openedAt\n    }\n  }\n": typeof types.PosHomeCajaStatusDocument,
    "\n  query PosRegisters($locationId: ID!) {\n    registers(locationId: $locationId) {\n      id name isActive locationId\n      openSession { id status openedAt expectedCashCents expectedCardCents expectedTransferCents }\n    }\n  }\n": typeof types.PosRegistersDocument,
    "\n  mutation OpenRegisterSession($registerId: ID!, $openingCashCents: Int) {\n    openRegisterSession(registerId: $registerId, openingCashCents: $openingCashCents) {\n      id status openedAt expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n": typeof types.OpenRegisterSessionDocument,
    "\n  mutation CloseRegisterSession($input: CloseRegisterSessionInput!) {\n    closeRegisterSession(input: $input) {\n      id status closedAt\n      countedCashCents countedCardCents countedTransferCents\n      expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n": typeof types.CloseRegisterSessionDocument,
    "\n  query PosWalkIns($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id status customerName customerPhone customerEmail createdAt\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n": typeof types.PosWalkInsDocument,
    "\n  mutation CreateWalkIn(\n    $locationId: ID!\n    $customerId: ID\n    $customerName: String\n    $customerPhone: String\n    $customerEmail: String\n    $requestedServiceId: ID\n  ) {\n    createWalkIn(\n      locationId: $locationId\n      customerId: $customerId\n      customerName: $customerName\n      customerPhone: $customerPhone\n      customerEmail: $customerEmail\n      requestedServiceId: $requestedServiceId\n    ) {\n      id status customerName customerPhone customerEmail createdAt\n      customer { id fullName email phone }\n      requestedService { id name baseDurationMin }\n    }\n  }\n": typeof types.CreateWalkInDocument,
    "\n  mutation AssignWalkIn($walkInId: ID!, $staffUserId: ID!) {\n    assignWalkIn(walkInId: $walkInId, staffUserId: $staffUserId) {\n      walkIn { id status assignedStaffUser { id fullName } }\n      warning\n    }\n  }\n": typeof types.AssignWalkInDocument,
    "\n  mutation CompleteWalkIn($walkInId: ID!) {\n    completeWalkIn(walkInId: $walkInId)\n  }\n": typeof types.CompleteWalkInDocument,
    "\n  mutation DropWalkIn($walkInId: ID!, $reason: String) { dropWalkIn(walkInId: $walkInId, reason: $reason) }\n": typeof types.DropWalkInDocument,
};
const documents: Documents = {
    "\n  query PosViewer {\n    viewer {\n      kind\n      staff {\n        id fullName email phone photoUrl isActive hasPosPin\n        pinAttempts pinLockedUntil\n      }\n      permissions\n      locationScopes { scopeType locationId }\n    }\n  }\n": types.PosViewerDocument,
    "\n  query PosPublicLocations {\n    posPublicLocations {\n      id\n      name\n    }\n  }\n": types.PosPublicLocationsDocument,
    "\n  mutation VerifyPosLocationAccess($locationId: ID!, $password: String!) {\n    verifyPosLocationAccess(locationId: $locationId, password: $password)\n  }\n": types.VerifyPosLocationAccessDocument,
    "\n  mutation StaffPinLogin($email: String!, $pin4: String!) {\n    staffPinLogin(email: $email, pin4: $pin4) {\n      viewer {\n        kind\n        staff {\n          id fullName email phone photoUrl isActive hasPosPin\n          pinAttempts pinLockedUntil\n        }\n        permissions\n        locationScopes { scopeType locationId }\n      }\n    }\n  }\n": types.StaffPinLoginDocument,
    "\n  query PosBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id fullName email phone photoUrl isActive hasPosPin\n      pinAttempts pinLockedUntil\n    }\n  }\n": types.PosBarbersDocument,
    "\n  query PosPinLockoutStatus($email: String!) {\n    posPinLockoutStatus(email: $email) {\n      lockedUntil\n      attemptsRemaining\n    }\n  }\n": types.PosPinLockoutStatusDocument,
    "\n  mutation PosLogout { logout }\n": types.PosLogoutDocument,
    "\n  query PosAppointments($dateFrom: String!, $dateTo: String!, $locationId: ID, $status: AppointmentStatus) {\n    appointments(dateFrom: $dateFrom, dateTo: $dateTo, locationId: $locationId, status: $status) {\n      id status salePaymentStatus startAt endAt totalCents\n      customer { id fullName phone }\n      staffUser { id fullName }\n      items { label serviceId qty unitPriceCents }\n      locationId locationName\n    }\n  }\n": types.PosAppointmentsDocument,
    "mutation CheckIn($id: ID!) { checkIn(appointmentId: $id) { id status } }": types.CheckInDocument,
    "mutation StartService($id: ID!) { startService(appointmentId: $id) { id status } }": types.StartServiceDocument,
    "mutation Complete($id: ID!) { complete(appointmentId: $id) { id status } }": types.CompleteDocument,
    "mutation NoShow($id: ID!) { noShow(appointmentId: $id) { id status } }": types.NoShowDocument,
    "\n  mutation PosFindOrCreateMostradorCustomer {\n    findOrCreateMostradorCustomer {\n      id\n      fullName\n    }\n  }\n": types.PosFindOrCreateMostradorCustomerDocument,
    "\n  query PosCheckoutBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id\n      fullName\n      photoUrl\n    }\n  }\n": types.PosCheckoutBarbersDocument,
    "\n  query PosCustomer($id: ID!) {\n    customer(id: $id) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n": types.PosCustomerDocument,
    "\n  query PosWalkInsForLookup($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id\n      status\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n": types.PosWalkInsForLookupDocument,
    "\n  query PosCatalogCategories {\n    catalogCategories {\n      id\n      name\n      slug\n      sortOrder\n      appliesTo\n    }\n  }\n": types.PosCatalogCategoriesDocument,
    "\n  query PosServices($locationId: ID!, $staffUserId: ID) {\n    services(locationId: $locationId) {\n      id\n      name\n      basePriceCents\n      baseDurationMin\n      isActive\n      isAddOn\n      imageUrl\n      categoryId\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n        durationMin\n        extras {\n          serviceId\n          name\n          priceCents\n          durationMin\n        }\n      }\n    }\n  }\n": types.PosServicesDocument,
    "\n  query PosResolveServicePrice($id: ID!, $locationId: ID!, $staffUserId: ID) {\n    service(id: $id) {\n      id\n      basePriceCents\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n      }\n    }\n  }\n": types.PosResolveServicePriceDocument,
    "\n  query PosCustomerHistory($customerId: ID!, $limit: Int) {\n    customerAppointments(customerId: $customerId, limit: $limit) {\n      id\n      status\n      startAt\n      items { label }\n    }\n  }\n": types.PosCustomerHistoryDocument,
    "\n  query PosProducts($locationId: ID!) {\n    products(locationId: $locationId) {\n      id\n      name\n      sku\n      imageUrl\n      categoryId\n      isActive\n      variants {\n        id\n        priceCents\n      }\n    }\n  }\n": types.PosProductsDocument,
    "\n  query PosInventoryLevels($locationId: ID!) {\n    posInventoryLevels(locationId: $locationId) {\n      productId\n      quantity\n    }\n  }\n": types.PosInventoryLevelsDocument,
    "\n  query PosCatalogCombos {\n    catalogCombos(activeOnly: true) {\n      id\n      name\n      priceCents\n      imageUrl\n      effectiveCategoryIds\n      items {\n        serviceId\n        productId\n        serviceName\n        productName\n        qty\n        sortOrder\n      }\n    }\n  }\n": types.PosCatalogCombosDocument,
    "\n  query PosSearchCustomers($query: String!, $limit: Int) {\n    searchCustomers(query: $query, limit: $limit) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n": types.PosSearchCustomersDocument,
    "\n  mutation FindOrCreateCustomer($name: String!, $email: String, $phone: String) {\n    findOrCreateCustomer(name: $name, email: $email, phone: $phone) {\n      id fullName email phone\n    }\n  }\n": types.FindOrCreateCustomerDocument,
    "\n  mutation CreatePosSale($input: CreatePOSSaleInput!) {\n    createPOSSale(input: $input) {\n      id\n      status\n      paymentStatus\n      totalCents\n      paidTotalCents\n    }\n  }\n": types.CreatePosSaleDocument,
    "\n  mutation ClockIn($locationId: ID!) { clockIn(locationId: $locationId) }\n": types.ClockInDocument,
    "\n  mutation ClockOut($locationId: ID!) { clockOut(locationId: $locationId) }\n": types.ClockOutDocument,
    "\n  query TimeClockEvents($staffUserId: ID!, $locationId: ID!, $fromDate: String!, $toDate: String!) {\n    timeClockEvents(staffUserId: $staffUserId, locationId: $locationId, fromDate: $fromDate, toDate: $toDate) {\n      id type at\n    }\n  }\n": types.TimeClockEventsDocument,
    "\n  query ShiftTemplates($staffUserId: ID!, $locationId: ID!) {\n    shiftTemplates(staffUserId: $staffUserId, locationId: $locationId) {\n      id staffUserId locationId dayOfWeek startMin endMin\n    }\n  }\n": types.ShiftTemplatesDocument,
    "\n  query PosHomeCommission($staffUserId: ID!, $locationId: ID!, $date: String!) {\n    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n  }\n": types.PosHomeCommissionDocument,
    "\n  query PosHomeCajaStatus($locationId: ID!) {\n    posCajaStatusHome(locationId: $locationId) {\n      isOpen\n      accumulatedCents\n      openedAt\n    }\n  }\n": types.PosHomeCajaStatusDocument,
    "\n  query PosRegisters($locationId: ID!) {\n    registers(locationId: $locationId) {\n      id name isActive locationId\n      openSession { id status openedAt expectedCashCents expectedCardCents expectedTransferCents }\n    }\n  }\n": types.PosRegistersDocument,
    "\n  mutation OpenRegisterSession($registerId: ID!, $openingCashCents: Int) {\n    openRegisterSession(registerId: $registerId, openingCashCents: $openingCashCents) {\n      id status openedAt expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n": types.OpenRegisterSessionDocument,
    "\n  mutation CloseRegisterSession($input: CloseRegisterSessionInput!) {\n    closeRegisterSession(input: $input) {\n      id status closedAt\n      countedCashCents countedCardCents countedTransferCents\n      expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n": types.CloseRegisterSessionDocument,
    "\n  query PosWalkIns($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id status customerName customerPhone customerEmail createdAt\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n": types.PosWalkInsDocument,
    "\n  mutation CreateWalkIn(\n    $locationId: ID!\n    $customerId: ID\n    $customerName: String\n    $customerPhone: String\n    $customerEmail: String\n    $requestedServiceId: ID\n  ) {\n    createWalkIn(\n      locationId: $locationId\n      customerId: $customerId\n      customerName: $customerName\n      customerPhone: $customerPhone\n      customerEmail: $customerEmail\n      requestedServiceId: $requestedServiceId\n    ) {\n      id status customerName customerPhone customerEmail createdAt\n      customer { id fullName email phone }\n      requestedService { id name baseDurationMin }\n    }\n  }\n": types.CreateWalkInDocument,
    "\n  mutation AssignWalkIn($walkInId: ID!, $staffUserId: ID!) {\n    assignWalkIn(walkInId: $walkInId, staffUserId: $staffUserId) {\n      walkIn { id status assignedStaffUser { id fullName } }\n      warning\n    }\n  }\n": types.AssignWalkInDocument,
    "\n  mutation CompleteWalkIn($walkInId: ID!) {\n    completeWalkIn(walkInId: $walkInId)\n  }\n": types.CompleteWalkInDocument,
    "\n  mutation DropWalkIn($walkInId: ID!, $reason: String) { dropWalkIn(walkInId: $walkInId, reason: $reason) }\n": types.DropWalkInDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosViewer {\n    viewer {\n      kind\n      staff {\n        id fullName email phone photoUrl isActive hasPosPin\n        pinAttempts pinLockedUntil\n      }\n      permissions\n      locationScopes { scopeType locationId }\n    }\n  }\n"): (typeof documents)["\n  query PosViewer {\n    viewer {\n      kind\n      staff {\n        id fullName email phone photoUrl isActive hasPosPin\n        pinAttempts pinLockedUntil\n      }\n      permissions\n      locationScopes { scopeType locationId }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosPublicLocations {\n    posPublicLocations {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query PosPublicLocations {\n    posPublicLocations {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation VerifyPosLocationAccess($locationId: ID!, $password: String!) {\n    verifyPosLocationAccess(locationId: $locationId, password: $password)\n  }\n"): (typeof documents)["\n  mutation VerifyPosLocationAccess($locationId: ID!, $password: String!) {\n    verifyPosLocationAccess(locationId: $locationId, password: $password)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StaffPinLogin($email: String!, $pin4: String!) {\n    staffPinLogin(email: $email, pin4: $pin4) {\n      viewer {\n        kind\n        staff {\n          id fullName email phone photoUrl isActive hasPosPin\n          pinAttempts pinLockedUntil\n        }\n        permissions\n        locationScopes { scopeType locationId }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation StaffPinLogin($email: String!, $pin4: String!) {\n    staffPinLogin(email: $email, pin4: $pin4) {\n      viewer {\n        kind\n        staff {\n          id fullName email phone photoUrl isActive hasPosPin\n          pinAttempts pinLockedUntil\n        }\n        permissions\n        locationScopes { scopeType locationId }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id fullName email phone photoUrl isActive hasPosPin\n      pinAttempts pinLockedUntil\n    }\n  }\n"): (typeof documents)["\n  query PosBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id fullName email phone photoUrl isActive hasPosPin\n      pinAttempts pinLockedUntil\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosPinLockoutStatus($email: String!) {\n    posPinLockoutStatus(email: $email) {\n      lockedUntil\n      attemptsRemaining\n    }\n  }\n"): (typeof documents)["\n  query PosPinLockoutStatus($email: String!) {\n    posPinLockoutStatus(email: $email) {\n      lockedUntil\n      attemptsRemaining\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation PosLogout { logout }\n"): (typeof documents)["\n  mutation PosLogout { logout }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosAppointments($dateFrom: String!, $dateTo: String!, $locationId: ID, $status: AppointmentStatus) {\n    appointments(dateFrom: $dateFrom, dateTo: $dateTo, locationId: $locationId, status: $status) {\n      id status salePaymentStatus startAt endAt totalCents\n      customer { id fullName phone }\n      staffUser { id fullName }\n      items { label serviceId qty unitPriceCents }\n      locationId locationName\n    }\n  }\n"): (typeof documents)["\n  query PosAppointments($dateFrom: String!, $dateTo: String!, $locationId: ID, $status: AppointmentStatus) {\n    appointments(dateFrom: $dateFrom, dateTo: $dateTo, locationId: $locationId, status: $status) {\n      id status salePaymentStatus startAt endAt totalCents\n      customer { id fullName phone }\n      staffUser { id fullName }\n      items { label serviceId qty unitPriceCents }\n      locationId locationName\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CheckIn($id: ID!) { checkIn(appointmentId: $id) { id status } }"): (typeof documents)["mutation CheckIn($id: ID!) { checkIn(appointmentId: $id) { id status } }"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation StartService($id: ID!) { startService(appointmentId: $id) { id status } }"): (typeof documents)["mutation StartService($id: ID!) { startService(appointmentId: $id) { id status } }"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation Complete($id: ID!) { complete(appointmentId: $id) { id status } }"): (typeof documents)["mutation Complete($id: ID!) { complete(appointmentId: $id) { id status } }"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation NoShow($id: ID!) { noShow(appointmentId: $id) { id status } }"): (typeof documents)["mutation NoShow($id: ID!) { noShow(appointmentId: $id) { id status } }"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation PosFindOrCreateMostradorCustomer {\n    findOrCreateMostradorCustomer {\n      id\n      fullName\n    }\n  }\n"): (typeof documents)["\n  mutation PosFindOrCreateMostradorCustomer {\n    findOrCreateMostradorCustomer {\n      id\n      fullName\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosCheckoutBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id\n      fullName\n      photoUrl\n    }\n  }\n"): (typeof documents)["\n  query PosCheckoutBarbers($locationId: ID!) {\n    barbers(locationId: $locationId) {\n      id\n      fullName\n      photoUrl\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosCustomer($id: ID!) {\n    customer(id: $id) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n"): (typeof documents)["\n  query PosCustomer($id: ID!) {\n    customer(id: $id) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosWalkInsForLookup($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id\n      status\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n"): (typeof documents)["\n  query PosWalkInsForLookup($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id\n      status\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosCatalogCategories {\n    catalogCategories {\n      id\n      name\n      slug\n      sortOrder\n      appliesTo\n    }\n  }\n"): (typeof documents)["\n  query PosCatalogCategories {\n    catalogCategories {\n      id\n      name\n      slug\n      sortOrder\n      appliesTo\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosServices($locationId: ID!, $staffUserId: ID) {\n    services(locationId: $locationId) {\n      id\n      name\n      basePriceCents\n      baseDurationMin\n      isActive\n      isAddOn\n      imageUrl\n      categoryId\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n        durationMin\n        extras {\n          serviceId\n          name\n          priceCents\n          durationMin\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query PosServices($locationId: ID!, $staffUserId: ID) {\n    services(locationId: $locationId) {\n      id\n      name\n      basePriceCents\n      baseDurationMin\n      isActive\n      isAddOn\n      imageUrl\n      categoryId\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n        durationMin\n        extras {\n          serviceId\n          name\n          priceCents\n          durationMin\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosResolveServicePrice($id: ID!, $locationId: ID!, $staffUserId: ID) {\n    service(id: $id) {\n      id\n      basePriceCents\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n      }\n    }\n  }\n"): (typeof documents)["\n  query PosResolveServicePrice($id: ID!, $locationId: ID!, $staffUserId: ID) {\n    service(id: $id) {\n      id\n      basePriceCents\n      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {\n        priceCents\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosCustomerHistory($customerId: ID!, $limit: Int) {\n    customerAppointments(customerId: $customerId, limit: $limit) {\n      id\n      status\n      startAt\n      items { label }\n    }\n  }\n"): (typeof documents)["\n  query PosCustomerHistory($customerId: ID!, $limit: Int) {\n    customerAppointments(customerId: $customerId, limit: $limit) {\n      id\n      status\n      startAt\n      items { label }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosProducts($locationId: ID!) {\n    products(locationId: $locationId) {\n      id\n      name\n      sku\n      imageUrl\n      categoryId\n      isActive\n      variants {\n        id\n        priceCents\n      }\n    }\n  }\n"): (typeof documents)["\n  query PosProducts($locationId: ID!) {\n    products(locationId: $locationId) {\n      id\n      name\n      sku\n      imageUrl\n      categoryId\n      isActive\n      variants {\n        id\n        priceCents\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosInventoryLevels($locationId: ID!) {\n    posInventoryLevels(locationId: $locationId) {\n      productId\n      quantity\n    }\n  }\n"): (typeof documents)["\n  query PosInventoryLevels($locationId: ID!) {\n    posInventoryLevels(locationId: $locationId) {\n      productId\n      quantity\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosCatalogCombos {\n    catalogCombos(activeOnly: true) {\n      id\n      name\n      priceCents\n      imageUrl\n      effectiveCategoryIds\n      items {\n        serviceId\n        productId\n        serviceName\n        productName\n        qty\n        sortOrder\n      }\n    }\n  }\n"): (typeof documents)["\n  query PosCatalogCombos {\n    catalogCombos(activeOnly: true) {\n      id\n      name\n      priceCents\n      imageUrl\n      effectiveCategoryIds\n      items {\n        serviceId\n        productId\n        serviceName\n        productName\n        qty\n        sortOrder\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosSearchCustomers($query: String!, $limit: Int) {\n    searchCustomers(query: $query, limit: $limit) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n"): (typeof documents)["\n  query PosSearchCustomers($query: String!, $limit: Int) {\n    searchCustomers(query: $query, limit: $limit) {\n      id\n      fullName\n      email\n      phone\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FindOrCreateCustomer($name: String!, $email: String, $phone: String) {\n    findOrCreateCustomer(name: $name, email: $email, phone: $phone) {\n      id fullName email phone\n    }\n  }\n"): (typeof documents)["\n  mutation FindOrCreateCustomer($name: String!, $email: String, $phone: String) {\n    findOrCreateCustomer(name: $name, email: $email, phone: $phone) {\n      id fullName email phone\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreatePosSale($input: CreatePOSSaleInput!) {\n    createPOSSale(input: $input) {\n      id\n      status\n      paymentStatus\n      totalCents\n      paidTotalCents\n    }\n  }\n"): (typeof documents)["\n  mutation CreatePosSale($input: CreatePOSSaleInput!) {\n    createPOSSale(input: $input) {\n      id\n      status\n      paymentStatus\n      totalCents\n      paidTotalCents\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ClockIn($locationId: ID!) { clockIn(locationId: $locationId) }\n"): (typeof documents)["\n  mutation ClockIn($locationId: ID!) { clockIn(locationId: $locationId) }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ClockOut($locationId: ID!) { clockOut(locationId: $locationId) }\n"): (typeof documents)["\n  mutation ClockOut($locationId: ID!) { clockOut(locationId: $locationId) }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TimeClockEvents($staffUserId: ID!, $locationId: ID!, $fromDate: String!, $toDate: String!) {\n    timeClockEvents(staffUserId: $staffUserId, locationId: $locationId, fromDate: $fromDate, toDate: $toDate) {\n      id type at\n    }\n  }\n"): (typeof documents)["\n  query TimeClockEvents($staffUserId: ID!, $locationId: ID!, $fromDate: String!, $toDate: String!) {\n    timeClockEvents(staffUserId: $staffUserId, locationId: $locationId, fromDate: $fromDate, toDate: $toDate) {\n      id type at\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ShiftTemplates($staffUserId: ID!, $locationId: ID!) {\n    shiftTemplates(staffUserId: $staffUserId, locationId: $locationId) {\n      id staffUserId locationId dayOfWeek startMin endMin\n    }\n  }\n"): (typeof documents)["\n  query ShiftTemplates($staffUserId: ID!, $locationId: ID!) {\n    shiftTemplates(staffUserId: $staffUserId, locationId: $locationId) {\n      id staffUserId locationId dayOfWeek startMin endMin\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosHomeCommission($staffUserId: ID!, $locationId: ID!, $date: String!) {\n    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n  }\n"): (typeof documents)["\n  query PosHomeCommission($staffUserId: ID!, $locationId: ID!, $date: String!) {\n    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosHomeCajaStatus($locationId: ID!) {\n    posCajaStatusHome(locationId: $locationId) {\n      isOpen\n      accumulatedCents\n      openedAt\n    }\n  }\n"): (typeof documents)["\n  query PosHomeCajaStatus($locationId: ID!) {\n    posCajaStatusHome(locationId: $locationId) {\n      isOpen\n      accumulatedCents\n      openedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosRegisters($locationId: ID!) {\n    registers(locationId: $locationId) {\n      id name isActive locationId\n      openSession { id status openedAt expectedCashCents expectedCardCents expectedTransferCents }\n    }\n  }\n"): (typeof documents)["\n  query PosRegisters($locationId: ID!) {\n    registers(locationId: $locationId) {\n      id name isActive locationId\n      openSession { id status openedAt expectedCashCents expectedCardCents expectedTransferCents }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation OpenRegisterSession($registerId: ID!, $openingCashCents: Int) {\n    openRegisterSession(registerId: $registerId, openingCashCents: $openingCashCents) {\n      id status openedAt expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n"): (typeof documents)["\n  mutation OpenRegisterSession($registerId: ID!, $openingCashCents: Int) {\n    openRegisterSession(registerId: $registerId, openingCashCents: $openingCashCents) {\n      id status openedAt expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CloseRegisterSession($input: CloseRegisterSessionInput!) {\n    closeRegisterSession(input: $input) {\n      id status closedAt\n      countedCashCents countedCardCents countedTransferCents\n      expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n"): (typeof documents)["\n  mutation CloseRegisterSession($input: CloseRegisterSessionInput!) {\n    closeRegisterSession(input: $input) {\n      id status closedAt\n      countedCashCents countedCardCents countedTransferCents\n      expectedCashCents expectedCardCents expectedTransferCents\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PosWalkIns($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id status customerName customerPhone customerEmail createdAt\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n"): (typeof documents)["\n  query PosWalkIns($locationId: ID!) {\n    walkIns(locationId: $locationId) {\n      id status customerName customerPhone customerEmail createdAt\n      assignedStaffUser { id fullName }\n      customer { id fullName email phone }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateWalkIn(\n    $locationId: ID!\n    $customerId: ID\n    $customerName: String\n    $customerPhone: String\n    $customerEmail: String\n    $requestedServiceId: ID\n  ) {\n    createWalkIn(\n      locationId: $locationId\n      customerId: $customerId\n      customerName: $customerName\n      customerPhone: $customerPhone\n      customerEmail: $customerEmail\n      requestedServiceId: $requestedServiceId\n    ) {\n      id status customerName customerPhone customerEmail createdAt\n      customer { id fullName email phone }\n      requestedService { id name baseDurationMin }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateWalkIn(\n    $locationId: ID!\n    $customerId: ID\n    $customerName: String\n    $customerPhone: String\n    $customerEmail: String\n    $requestedServiceId: ID\n  ) {\n    createWalkIn(\n      locationId: $locationId\n      customerId: $customerId\n      customerName: $customerName\n      customerPhone: $customerPhone\n      customerEmail: $customerEmail\n      requestedServiceId: $requestedServiceId\n    ) {\n      id status customerName customerPhone customerEmail createdAt\n      customer { id fullName email phone }\n      requestedService { id name baseDurationMin }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AssignWalkIn($walkInId: ID!, $staffUserId: ID!) {\n    assignWalkIn(walkInId: $walkInId, staffUserId: $staffUserId) {\n      walkIn { id status assignedStaffUser { id fullName } }\n      warning\n    }\n  }\n"): (typeof documents)["\n  mutation AssignWalkIn($walkInId: ID!, $staffUserId: ID!) {\n    assignWalkIn(walkInId: $walkInId, staffUserId: $staffUserId) {\n      walkIn { id status assignedStaffUser { id fullName } }\n      warning\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CompleteWalkIn($walkInId: ID!) {\n    completeWalkIn(walkInId: $walkInId)\n  }\n"): (typeof documents)["\n  mutation CompleteWalkIn($walkInId: ID!) {\n    completeWalkIn(walkInId: $walkInId)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DropWalkIn($walkInId: ID!, $reason: String) { dropWalkIn(walkInId: $walkInId, reason: $reason) }\n"): (typeof documents)["\n  mutation DropWalkIn($walkInId: ID!, $reason: String) { dropWalkIn(walkInId: $walkInId, reason: $reason) }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;