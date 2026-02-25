import * as Localization from 'expo-localization';
import i18n from 'i18n-js';

import en from './locale/en.json';
import rw from './locale/rw.json';
import fr from './locale/fr.json';

i18n.translations = {
  en,
  rw,
  fr,
};

i18n.locale = Localization.getLocales()[0].languageCode || 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n;
