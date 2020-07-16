import TsxComponent, { createProps } from '../../tsx-component';
import { Inject } from '../../../services/core';
import { StreamingService, TGoLiveChecklistItemState } from '../../../services/streaming';
import { WindowsService } from '../../../services/windows';
import { $t } from 'services/i18n';
import { Component } from 'vue-property-decorator';
import styles from './GoLiveError.m.less';
import cx from 'classnames';
import { YoutubeService } from '../../../services/platforms/youtube';
import { getPlatformService, TPlatform } from '../../../services/platforms';
import { TwitterService } from '../../../services/integrations/twitter';
import { IStreamError } from '../../../services/streaming/stream-error';
import Translate from '../../shared/translate';
import electron, { shell } from 'electron';
import { UserService } from '../../../services/user';
import { NavigationService } from '../../../services/navigation';

/**
 * Shows error and troubleshooting suggestions
 */
@Component({})
export default class GoLiveError extends TsxComponent<{}> {
  @Inject() private streamingService: StreamingService;
  @Inject() private windowsService: WindowsService;
  @Inject() private youtubeService: YoutubeService;
  @Inject() private twitterService: TwitterService;
  @Inject() private userService: UserService;
  @Inject() private navigationService: NavigationService;

  private get view() {
    return this.streamingService.views;
  }

  private goToYoutubeDashboard() {
    electron.remote.shell.openExternal(this.youtubeService.state.dashboardUrl);
  }

  private createFBPage() {
    electron.remote.shell.openExternal(
      'https://www.facebook.com/gaming/pages/create?ref=streamlabs',
    );
    this.windowsService.actions.closeChildWindow();
  }

  private skipPrepopulateAndGoLive() {
    this.streamingService.actions.goLive();
  }

  private skipSettingsUpdateAndGoLive() {
    this.streamingService.actions.finishStartStreaming();
    this.windowsService.actions.closeChildWindow();
  }

  private navigatePlatformMerge(platform: TPlatform) {
    this.navigationService.navigate('PlatformMerge', { platform });
    this.windowsService.actions.closeChildWindow();
  }

  private enableYT() {
    this.youtubeService.actions.openYoutubeEnable();
  }

  private render() {
    const error = this.view.info.error;
    if (!error) return;
    switch (error.type) {
      case 'PREPOPULATE_FAILED':
        return this.renderPrepopulateError(error);
      case 'FACEBOOK_HAS_NO_PAGES':
        return this.renderFacebookNoPagesError(error);
      case 'TWITCH_MISSED_OAUTH_SCOPE':
        return this.renderTwitchMissedScopeError(error);
      case 'SETTINGS_UPDATE_FAILED':
        return this.renderSettingsUpdateError(error);
      case 'RESTREAM_DISABLED':
      case 'RESTREAM_SETUP_FAILED':
        return this.renderRestreamError(error);
      case 'YOUTUBE_STREAMING_DISABLED':
        return this.renderYoutubeStreamingDisabled(error);
      case 'YOUTUBE_PUBLISH_FAILED':
        return this.renderYoutubePublishError(error);
      default:
        return <ErrorLayout error={error} />;
    }
  }

  private renderPrepopulateError(error: IStreamError) {
    const platformName = getPlatformService(error.platform).displayName;
    return (
      <ErrorLayout
        error={error}
        message={$t('Can not fetch settings from %{platformName}', { platformName })}
      >
        <Translate
          message={$t('prepopulateStreamSettingsError')}
          scopedSlots={{
            fetchAgainLink: (text: string) => (
              <a
                class={styles.link}
                onClick={() => this.streamingService.actions.prepopulateInfo()}
              >
                {{ text }}
              </a>
            ),
            justGoLiveLink: (text: string) => (
              <a class={styles.link} onclick={() => this.skipPrepopulateAndGoLive()}>
                {{ text }}
              </a>
            ),
          }}
        />
      </ErrorLayout>
    );
  }

  private renderTwitchMissedScopeError(error: IStreamError) {
    // If primary platform, then ask to re-login
    if (this.userService.state.auth.primaryPlatform === 'twitch') {
      return this.renderPrepopulateError(error);
    }

    // If not primary platform than ask to connect platform again from SLOBS
    const platformName = getPlatformService(error.platform).displayName;
    return (
      <ErrorLayout message={$t('Can not fetch settings from %{platformName}', { platformName })}>
        <Translate
          message={$t('twitchMissedScopeError')}
          scopedSlots={{
            connectButton: (text: string) => (
              <button
                class="button button--twitch"
                onClick={() => this.navigatePlatformMerge('twitch')}
              >
                {{ text }}
              </button>
            ),
          }}
        />
      </ErrorLayout>
    );
  }

  private renderSettingsUpdateError(error: IStreamError) {
    const platformName = getPlatformService(error.platform).displayName;
    return (
      <ErrorLayout
        error={error}
        message={$t('Can not update settings for %{platformName}', { platformName })}
      >
        <Translate
          message={$t('updateStreamSettingsError')}
          scopedSlots={{
            tryAgainLink: (text: string) => (
              <a class={styles.link} onClick={() => this.streamingService.actions.goLive()}>
                {{ text }}
              </a>
            ),
            justGoLiveLink: (text: string) => (
              <a class={styles.link} onclick={() => this.skipSettingsUpdateAndGoLive()}>
                {{ text }}
              </a>
            ),
          }}
        />
      </ErrorLayout>
    );
  }

  private renderYoutubeStreamingDisabled(error: IStreamError) {
    return (
      <ErrorLayout message={error.message}>
        <button class="button button--warn" onClick={() => this.enableYT()}>
          {$t('Fix')}
        </button>
      </ErrorLayout>
    );
  }

  private renderRestreamError(error: IStreamError) {
    return (
      <ErrorLayout error={error}>
        {$t('You could try reducing the number of your destinations to one for direct streaming.')}
      </ErrorLayout>
    );
  }

  private renderYoutubePublishError(error: IStreamError) {
    return (
      <ErrorLayout error={error}>
        <Translate
          message={$t('youtubeStatusError')}
          scopedSlots={{
            dashboardLink: (text: string) => (
              <a class={styles.link} onClick={() => this.goToYoutubeDashboard()}>
                {{ text }}
              </a>
            ),
          }}
        />
      </ErrorLayout>
    );
  }

  private renderFacebookNoPagesError(error: IStreamError) {
    return (
      <ErrorLayout error={error}>
        <Translate
          message={$t('facebookNoPagesError')}
          scopedSlots={{
            createLink: (text: string) => (
              <a class={styles.link} onClick={() => this.createFBPage()}>
                {{ text }}
              </a>
            ),
          }}
        />
      </ErrorLayout>
    );
  }
}

class ErrorLayoutProps {
  error?: IStreamError = null;
  /**
   * overrides the error message if provided
   */
  message?: string = '';
}

/**
 * Layout for displaying an single error
 */
@Component({ props: createProps(ErrorLayoutProps) })
class ErrorLayout extends TsxComponent<ErrorLayoutProps> {
  private isErrorDetailsShown = false;

  private render() {
    const error = this.props.error;
    const message = this.props.message || error.message;
    const details = error?.details;
    return (
      <div class={cx('section selectable', styles.container)}>
        <p class={styles.title}>
          <i class="fa fa-warning" /> {message}
        </p>
        <p>{this.$slots.default}</p>

        {details && !this.isErrorDetailsShown && (
          <p style={{ textAlign: 'right' }}>
            <a class={styles.link} onclick={() => (this.isErrorDetailsShown = true)}>
              {$t('Show details')}
            </a>
          </p>
        )}
        {details && this.isErrorDetailsShown && <p class={styles.details}>{details}</p>}
      </div>
    );
  }
}
