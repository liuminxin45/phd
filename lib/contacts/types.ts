export interface ContactRecord {
  key: string;
  index: number;
  name: string;
  department: string;
  phones: string[];
  locations: string[];
  emails: string[];
}

export interface ContactsSnapshotStatistics {
  totalPhones: number;
  totalEmails: number;
  totalLocations: number;
  departments: number;
}

export interface ContactsSnapshot {
  snapshotDate: string;
  fetchedAt: string;
  totalContacts: number;
  contacts: ContactRecord[];
  statistics: ContactsSnapshotStatistics;
}

export interface ContactFieldChange {
  field: 'name' | 'department' | 'phones' | 'locations' | 'emails';
  before: string | string[];
  after: string | string[];
}

export interface ContactChangedRecord {
  key: string;
  before: ContactRecord;
  after: ContactRecord;
  fieldsChanged: ContactFieldChange[];
}

export interface ContactsDiff {
  fromDate: string;
  toDate: string;
  summary: {
    totalBefore: number;
    totalAfter: number;
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  added: ContactRecord[];
  removed: ContactRecord[];
  changed: ContactChangedRecord[];
}

export interface ContactsTrendPoint {
  date: string;
  added: number;
  removed: number;
  totalContacts: number;
}

export interface ContactsSnapshotResponse {
  snapshot: ContactsSnapshot | null;
  availableDates: string[];
  today: string;
  source: 'cache' | 'remote' | 'empty';
}
