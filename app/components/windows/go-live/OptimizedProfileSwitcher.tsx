import TsxComponent, { createProps } from '../../tsx-component';
import Component from 'vue-class-component';
import HFormGroup from '../../shared/inputs/HFormGroup.vue';
import { $t } from '../../../services/i18n';
import { BoolInput } from '../../shared/inputs/inputs';
import { SyncWithValue } from '../../../services/app/app-decorators';
import { IGoLiveSettings } from '../../../services/streaming';
import { Inject } from '../../../services/core';
import { VideoEncodingOptimizationService } from '../../../app-services';
import { IEncoderProfile } from 'services/video-encoding-optimizations';
import { Watch } from 'vue-property-decorator';

class Props {
  settings: IGoLiveSettings = null;
}

@Component({ props: createProps(Props) })
export class OptimizedProfileSwitcher extends TsxComponent<Props> {
  @Inject() private videoEncodingOptimizationService: VideoEncodingOptimizationService;
  private loading: boolean = false;
  @SyncWithValue() private selectedProfile: IEncoderProfile = null;

  get game() {
    return this.props.settings.destinations.twitch?.game || '';
  }

  @Watch('game', { immediate: true })
  private async loadAvailableProfiles() {
    this.loading = true;
    this.selectedProfile = await this.videoEncodingOptimizationService.fetchOptimizedProfile(
      this.game,
    );
    this.loading = false;
  }

  get useOptimizedProfile() {
    return this.videoEncodingOptimizationService.state.useOptimizedProfile;
  }

  set useOptimizedProfile(enabled: boolean) {
    this.videoEncodingOptimizationService.useOptimizedProfile(enabled);
  }

  created() {
    this.loadAvailableProfiles();
  }

  get optimizedProfileMetadata() {
    const game = this.game;
    const title =
      this.selectedProfile && this.selectedProfile.game !== 'DEFAULT'
        ? $t('Use optimized encoder settings for %{game}', { game })
        : $t('Use optimized encoder settings');
    return {
      title,
      tooltip: $t(
        'Optimized encoding provides better quality and/or lower cpu/gpu usage. Depending on the game, ' +
          'resolution may be changed for a better quality of experience',
      ),
    };
  }

  private render() {
    const game = this.game;
    return (
      <HFormGroup metadata={{ tooltip: this.optimizedProfileMetadata.tooltip }}>
        {this.loading && $t('Checking optimized setting for %{game}', { game })}
        {!this.loading && (
          <BoolInput vModel={this.useOptimizedProfile} metadata={this.optimizedProfileMetadata} />
        )}
      </HFormGroup>
    );
  }
}
