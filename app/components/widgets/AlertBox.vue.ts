import { Component } from 'vue-property-decorator';
import WidgetEditor from 'components/windows/WidgetEditor.vue';
import WidgetSettings from './WidgetSettings.vue';
import { inputComponents } from 'components/widgets/inputs';
import VFormGroup from 'components/shared/inputs/VFormGroup.vue';
import { IAlertBoxData, AlertBoxService } from 'services/widgets/settings/alert-box';
import { $t } from 'services/i18n';

import ValidatedForm from 'components/shared/inputs/ValidatedForm.vue';
import { Inject } from 'util/injector';
import { IAlertBoxVariation } from 'services/widgets/settings/alert-box/alert-box-api';

const alertNameMap = () => ({
  bits: $t('Bits'),
  donations: $t('Donations'),
  donordrive: $t('Charity Streaming Donations'),
  patreon: $t('Patreon Pledges'),
  extraLife: $t('Extra Life Donations'),
  justGiving: $t('JustGiving Donations'),
  merch: $t('Merch'),
  resubs: $t('Resubs'),
  gamewisp: $t('Gamewisp Subscriptions'),
  subs: $t('Subscriptions'),
  tiltify: $t('Tiltify Donations'),
  treat: $t('TreatStream'),
  follows: $t('Follows'),
  hosts: $t('Hosts'),
  raids: $t('Raids')
});

const triggerAmountMap = {
  bits: 'bits_alert_min_amount',
  donations: 'donation_alert_min_amount',
  hosts: 'host_viewer_minimum',
  raids: 'raid_raider_minimum'
};

@Component({
  components: {
    WidgetEditor,
    VFormGroup,
    ValidatedForm,
    ...inputComponents
  }
})
export default class AlertBox extends WidgetSettings<IAlertBoxData, AlertBoxService> {
  @Inject() alertBoxService: AlertBoxService;

  $refs: { [key: string]: HTMLElement };

  afterFetch() {
    this.alertTypes = this.alertTypes.filter((type) => this.wData.settings[type]);
    console.log(this.wData);
  }

  alertName(alertType: string) {
    return alertNameMap()[alertType];
  }

  alertTypes = this.alertBoxService.apiNames();

  addAlertMenuOpen = false;
  selectedAlert = 'general';
  selectedId = 'default';
  editingName: string = null;

  get selectedVariation() {
    if (this.selectedAlert === 'general') { return this.wData }
    return this.wData.settings[this.selectedAlert].variations.find(
      (variation: IAlertBoxVariation) => variation.id === this.selectedId
    );
  }

  get navItems() {
    if (this.selectedAlert === 'general') {
      return [
        { value: 'general', label: $t('General Settings') },
        { value: 'moderation', label: $t('Moderator Tools') },
        { value: 'source', label: $t('Source') }
      ];
    }
    const baseItems = [
      { value: 'title', label: $t('Title Message') },
      { value: 'media', label: $t('Media') },
      { value: 'animation', label: $t('Animation') }
    ];
    if (this.selectedVariation.settings.message) {
      baseItems.push({ value: 'message', label: $t('Donor Message') })
    }
    if (['donations', 'bits', 'hosts', 'raids'].includes(this.selectedAlert) || this.selectedId !== 'default') {
      baseItems.push({ value: 'alert', label: $t('Alert Settings') })
    }
    return baseItems;
  }

  get conditions() {
    return this.alertBoxService.conditionsByType(this.selectedAlert);
  }

  get minTriggerAmount() {
    return this.wData.settings[triggerAmountMap[this.selectedAlert]];
  }

  set minTriggerAmount(value: number) {
    this.wData.settings[triggerAmountMap[this.selectedAlert]] = value;
  }


  get minRecentEvents() {
    return this.selectedAlert === 'donation' ?
      this.wData.settings.recent_events_donation_min_amount : this.wData.settings.recent_events_host_min_viewer_count;
  }

  set minRecentEvents(value: number) {
    if (this.selectedAlert === 'donation') {
      this.wData.settings.recent_events_donation_min_amount = value;
    } else {
      this.wData.settings.recent_events_host_min_viewer_count = value;
    }
  }

  selectAlertType(alertName: string) {
    this.selectedId = 'default';
    this.selectedAlert = this.selectedAlert === alertName ? 'general' : alertName;
  }

  selectVariation(id: string) {
    this.selectedId = id;
  }

  toggleAddAlertMenu() {
    this.addAlertMenuOpen = !this.addAlertMenuOpen;
  }

  addAlert(type: string) {
    const newVariation = this.alertBoxService.newVariation(type);
    this.wData.settings[type].variations.push(newVariation);
    this.selectedAlert = type;
    this.addAlertMenuOpen = false;
    this.save();
    this.$nextTick(() => this.editName(newVariation.id));
  }

  removeVariation(id: string) {
    this.selectedId = 'default';
    this.wData.settings[this.selectedAlert].variations = this.wData.settings[this.selectedAlert].variations.filter(
      (variation: IAlertBoxVariation) => variation.id !== id
    );
    this.save();
  }

  editName(id: string) {
    this.editingName = id;
    this.selectedId = id;
    const field = <HTMLInputElement>this.$refs[`${id}-name-input`][0];
    this.$nextTick(() => field.focus());
  }

  nameInputHandler(eventData: string) {
    this.selectedVariation.name = eventData;
  }

  nameBlurHandler(id: string) {
    this.save();
    this.editingName = null;
  }
}
