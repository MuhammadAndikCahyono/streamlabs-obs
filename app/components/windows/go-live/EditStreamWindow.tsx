import TsxComponent from 'components/tsx-component';
import ModalLayout from 'components/ModalLayout.vue';
import { $t } from 'services/i18n';
import { Component, Watch } from 'vue-property-decorator';
import PlatformLogo from 'components/shared/PlatformLogo';
import styles from './GoLive.m.less';
import { Inject } from 'services/core';
import { UserService } from 'services/user';
import { getPlatformService, TPlatform } from 'services/platforms';
import { BoolInput, ToggleInput } from 'components/shared/inputs/inputs';
import cx from 'classnames';
import { formMetadata, IListOption, metadata } from 'components/shared/inputs';
import { SettingsService } from 'services/settings';
import HFormGroup from '../../shared/inputs/HFormGroup.vue';
import { WindowsService } from 'services/windows';
import { IGoLiveSettings, StreamingService } from 'services/streaming';

import cloneDeep from 'lodash/cloneDeep';
import { StreamSettingsService } from '../../../services/settings/streaming';
import ValidatedForm from '../../shared/inputs/ValidatedForm';
import GoLiveChecklist from './GoLiveChecklist';
import PlatformSettings from './PlatformSettings';
import CommonPlatformFields from '../../platforms/CommonPlatformFields';

/**
 * Allows to update stream setting while being live
 **/
@Component({})
export default class EditStreamWindow extends TsxComponent<{}> {
  @Inject() private userService: UserService;
  @Inject() private settingsService: SettingsService;
  @Inject() private streamingService: StreamingService;
  @Inject() private streamSettingsService: StreamSettingsService;
  @Inject() private windowsService: WindowsService;

  $refs: {
    form: ValidatedForm;
  };

  private settings: IGoLiveSettings = cloneDeep(this.streamingService.views.goLiveSettings);

  private get view() {
    return this.streamingService.views;
  }

  private async submit() {
    if (!(await this.$refs.form.validate())) return;
    await this.streamingService.actions.return.updateStreamSettings(this.settings);
    this.$toasted.success($t('Successfully updated'), {
      position: 'bottom-center',
      duration: 1000,
      singleton: true,
    });
  }

  private goBack() {
    this.streamingService.actions.showEditStream();
  }

  private close() {
    this.windowsService.actions.closeChildWindow();
  }

  private switchAdvancedMode(advancedMode: boolean) {
    this.settings.advancedMode = advancedMode;
    this.streamSettingsService.actions.setGoLiveSettings({ advancedMode });
  }

  private render() {
    const lifecycle = this.view.info.lifecycle;
    const shouldShowSettings = lifecycle === 'live';
    const shouldShowChecklist = lifecycle === 'runChecklist';
    return (
      <ModalLayout customControls={true} showControls={false}>
        <ValidatedForm ref="form" slot="content" name="editStreamForm">
          {shouldShowSettings && <PlatformSettings vModel={this.settings} />}
          {shouldShowChecklist && <GoLiveChecklist isUpdateMode={true} />}
        </ValidatedForm>
        <div slot="controls">{this.renderControls()}</div>
      </ModalLayout>
    );
  }

  private renderControls() {
    const lifecycle = this.view.info.lifecycle;
    const shouldShowUpdateButton = lifecycle === 'live';
    const shouldShowGoBackButton = !shouldShowUpdateButton && this.view.info.error;
    const advancedMode = this.view.goLiveSettings.advancedMode;
    const shouldShowAdvancedSwitch = shouldShowUpdateButton && this.view.isMutliplatformMode;

    return (
      <div class="controls" style={{ display: 'flex', 'flex-direction': 'row-reverse' }}>
        {/* UPDATE BUTTON */}
        {shouldShowUpdateButton && (
          <button
            class={cx('button button--action', styles.goLiveButton)}
            onClick={() => this.submit()}
          >
            {$t('Update')}
          </button>
        )}

        {/* GO BACK BUTTON */}
        {shouldShowGoBackButton && (
          <button
            class={cx('button button--action', styles.goLiveButton)}
            onClick={() => this.goBack()}
          >
            {$t('Go back')}
          </button>
        )}

        {/* CLOSE BUTTON */}
        <button
          onClick={() => this.close()}
          class={cx('button button--default', styles.cancelButton)}
        >
          {$t('Close')}
        </button>

        {/* ADVANCED MODE SWITCHER */}
        {shouldShowAdvancedSwitch && (
          <div class={styles.modeToggle}>
            <div>{$t('Show Advanced Settings')}</div>
            <ToggleInput
              onInput={(val: boolean) => this.switchAdvancedMode(val)}
              value={this.settings.advancedMode}
            />
          </div>
        )}
      </div>
    );
  }
}