import { Component } from 'vue-property-decorator';
import TsxComponent, { createProps } from 'components/tsx-component';
import electron from 'electron';
import { Inject } from 'services';
import { UserService, EAuthProcessState } from 'services/user';
import { NavigationService } from 'services/navigation';
import { $t } from 'services/i18n';
import { RestreamService } from 'services/restream';
import { StreamSettingsService } from 'services/settings/streaming';
import { SceneCollectionsService } from 'services/scene-collections';
import { getPlatformService, TPlatform } from '../../services/platforms';
import PlatformLogo from '../shared/PlatformLogo';

class PlatformMergeProps {
  params: {
    platform?: TPlatform;
    overlayUrl?: string;
    overlayName?: string;
  } = {};
}

@Component({ props: createProps(PlatformMergeProps) })
export default class PlatformMerge extends TsxComponent<PlatformMergeProps> {
  @Inject() userService: UserService;
  @Inject() navigationService: NavigationService;
  @Inject() restreamService: RestreamService;
  @Inject() streamSettingsService: StreamSettingsService;
  @Inject() sceneCollectionsService: SceneCollectionsService;

  showOverlay = false;
  showLogin = false;

  get platform() {
    return this.props.params.platform;
  }

  created() {
    if (!this.platform) throw new Error('Platform should be provided for PlatformMerge');
    if (this.platform !== 'facebook') this.showLogin = true;
  }

  get loading() {
    return this.userService.state.authProcessState === EAuthProcessState.Busy;
  }

  get platformName() {
    return getPlatformService(this.platform).displayName;
  }

  private openFBPageCreation() {
    electron.remote.shell.openExternal(
      'https://www.facebook.com/gaming/pages/create?ref=streamlabs',
    );
    this.showLogin = true;
  }

  private skipPageCreation() {
    this.showLogin = true;
  }

  private async mergePlatform(platform: TPlatform) {
    const mode = platform === 'youtube' ? 'external' : 'internal';
    await this.userService.startAuth(platform, mode, true);
    this.streamSettingsService.setSettings({ protectedModeEnabled: true });

    if (this.props.params.overlayUrl) {
      this.showOverlay = true;
    } else {
      this.navigationService.navigate('Studio');
    }
  }

  async installOverlay() {
    if (this.props.params.overlayUrl) {
      await this.sceneCollectionsService.installOverlay(
        this.props.params.overlayUrl,
        this.props.params.overlayName,
      );
    }

    this.navigationService.navigate('Studio');
  }

  get createPageStep() {
    return (
      <div>
        <div>{$t('Create a Facebook Gaming page to get started.')}</div>
        <button
          style={{ marginTop: '24px', marginRight: '24px' }}
          class="button button--action"
          onclick={() => this.skipPageCreation()}
        >
          {$t('I already have a Gaming Page')}
        </button>
        <button
          style={{ marginTop: '24px' }}
          class="button button--action"
          onClick={() => this.openFBPageCreation()}
        >
          {$t('Create a Gaming Page')}
        </button>
      </div>
    );
  }

  get loginStep() {
    const platformName = this.platformName;
    return (
      <div>
        <div>
          {$t('Connect %{platformName} to Streamlabs OBS.', { platformName })}
          <br />
          {$t('All of your scenes, sources, and settings will be preserved.')}
        </div>
        <button
          style={{ marginTop: '24px' }}
          class={`button button--${this.platform}`}
          disabled={this.loading}
          onClick={() => this.mergePlatform(this.platform)}
        >
          {this.loading && <i class="fas fa-spinner fa-spin" />}
          {$t('Connect')}
        </button>
      </div>
    );
  }

  get overlayStep() {
    return (
      <div>
        <div>
          <b>{$t('Step')} 3:</b> {$t('Install Your Theme')}
          <br />
        </div>
        <button
          style={{ marginTop: '24px' }}
          class="button button--action"
          disabled={this.loading}
          onClick={() => this.installOverlay()}
        >
          <i class={this.loading ? 'fas fa-spinner fa-spin' : 'icon-themes'} />
          {`${$t('Install')} ${this.props.params.overlayName}`}
        </button>
      </div>
    );
  }

  get currentStep() {
    if (this.showOverlay) return this.overlayStep;
    if (this.showLogin) return this.loginStep;
    return this.createPageStep;
  }

  render() {
    const platformName = this.platformName;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '400px' }}>
          <h1>{$t('Connect %{platformName}', { platformName })}</h1>
          {this.currentStep}
        </div>
      </div>
    );
  }
}
