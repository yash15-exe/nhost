import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import ControlledSelect from '@/components/common/ControlledSelect';
import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import CopyIcon from '@/components/ui/v2/icons/CopyIcon';
import useCurrentWorkspaceAndApplication from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import Button from '@/ui/v2/Button';
import IconButton from '@/ui/v2/IconButton';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import InputLabel from '@/ui/v2/InputLabel';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import Text from '@/ui/v2/Text';
import copy from '@/utils/copy';
import getUserRoles from '@/utils/settings/getUserRoles';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import {
  useGetRolesQuery,
  useUpdateRemoteAppUserMutation
} from '@/utils/__generated__/graphql';

import { yupResolver } from '@hookform/resolvers/yup';
import { Avatar } from '@mui/material';
import { format, formatRelative } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface EditUserFormProps {
  /**
   * The selected user.
   */
  user: RemoteAppGetUsersQuery['users'][0];
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export const EditUserFormValidationSchema = Yup.object({
  displayName: Yup.string().required('This field is required.'),
  avatarURL: Yup.string().required('This field is required.'),
  email: Yup.string()
    .email('Invalid email address')
    .required('This field is required.'),
  emailVerified: Yup.boolean().optional(),
  phoneNumber: Yup.string().nullable(),
  phoneNumberVerified: Yup.boolean().optional(),
  locale: Yup.string(),
  defaultRole: Yup.string(),
  roles: Yup.array().of(Yup.string()),
});

export type EditUserFormValues = Yup.InferType<
  typeof EditUserFormValidationSchema
>;

export default function EditUserForm({
  user,
  onCancel,
  ...props
}: EditUserFormProps) {
  const { onDirtyStateChange, openDialog, openAlertDialog } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
  });

  const { data } = useGetRolesQuery({
    variables: { id: currentApplication.id },
    fetchPolicy: 'cache-first',
  });

  const allAvailableProjectRoles = useMemo(
    () => getUserRoles(data?.app?.authUserDefaultAllowedRoles),
    [data],
  );

  const form = useForm<EditUserFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(EditUserFormValidationSchema),
    defaultValues: {
      avatarURL: user.avatarUrl,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      locale: user.locale,
      defaultRole: user.defaultRole,
      roles: user.roles.map((role) => role.role),
    },
  });

  const {
    register,
    formState: { errors, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  function handleChangeUserPassword() {
    openDialog('EDIT_USER_PASSWORD', {
      title: 'Change Password',
      payload: { user },
      props: {
        titleProps: { className: 'mx-auto' },
        PaperProps: { className: 'max-w-md' },
      },
    });
  }

  async function handleUserEdit(values: EditUserFormValues) {
    const updateUserMutationPromise = updateUser({
      variables: {
        id: user.id,
        user: {
          displayName: values.displayName,
          email: values.email,
          avatarUrl: values.avatarURL,
          emailVerified: values.emailVerified,
        },
      },
    });

    await toast.promise(
      updateUserMutationPromise,
      {
        loading: `Updating user's settings...`,
        success: 'User settings updated successfully!',
        error: 'Failed to update user settings.',
      },
      { ...toastStyleProps },
    );

    form.reset(values);
  }

  return (
    <FormProvider {...form}>
      <Form className="divide-y border-y" onSubmit={handleUserEdit}>
        <section className="grid grid-flow-col grid-cols-7 p-6">
          <div className="grid grid-flow-col col-span-6 gap-4 place-content-start">
            {!user.avatarUrl.includes('default=blank') ? (
              <Avatar className="w-12 h-12" src={user.avatarUrl} />
            ) : (
              <Avatar className="relative inline-flex items-center justify-center w-12 h-12 overflow-hidden bg-gray-300 rounded-full">
                <span className="text-xs font-medium text-gray-600 uppercase">
                  {user.displayName.slice(0, 2)}
                </span>
              </Avatar>
            )}
            <div className="grid items-center grid-flow-row">
              <Text className="text-lg font-medium">{user.displayName}</Text>
              <Text className="font-normal text-sm+ text-greyscaleGreyDark">
                {user.email}
              </Text>
            </div>
          </div>
          <div className="items-center">
            <Select placeholder="Actions" hideEmptyHelperText>
              <Option
                value="Actions"
                className="text-sm+ font-medium text-red"
                onClick={() => {
                  openAlertDialog({
                    title: 'Delete User',
                    payload: (
                      <Text>
                        Are you sure you want to delete the &quot;
                        <strong>{user.displayName}</strong>&quot; user?
                        <br /> This cannot be undone.
                      </Text>
                    ),
                    props: {
                      primaryButtonColor: 'error',
                      primaryButtonText: 'Delete',
                      titleProps: { className: 'mx-auto' },
                      PaperProps: { className: 'max-w-lg mx-auto' },
                    },
                  });
                }}
              >
                Delete User
              </Option>
            </Select>
          </div>
        </section>
        <section className="grid grid-flow-row grid-cols-4 gap-8 p-6">
          <InputLabel as="h3" className="col-span-1">
            User ID
          </InputLabel>
          <Text className="col-span-3 font-medium">
            {user.id}
            <IconButton
              color="secondary"
              variant="borderless"
              className="ml-1"
              onClick={(e) => {
                e.stopPropagation();
                copy(user.id, 'User ID');
              }}
            >
              <CopyIcon className="w-4 h-4" />
            </IconButton>
          </Text>

          <InputLabel as="h3" className="col-span-1">
            Created
          </InputLabel>
          <Text className="col-span-3 font-medium">
            {format(new Date(user.createdAt), 'd MMM yyyy')}
          </Text>

          <InputLabel as="h3" className="col-span-1">
            Last Seen
          </InputLabel>
          <Text className="col-span-3 font-medium">
            {user.lastSeen
              ? formatRelative(new Date(), new Date(user.lastSeen))
              : 'Never'}
          </Text>
        </section>
        <section className="grid grid-flow-row gap-8 p-6">
          <Input
            {...register('displayName')}
            id="Display Name"
            label="Display Name"
            variant="inline"
            placeholder="Enter Display Name"
            hideEmptyHelperText
            error={!!errors.displayName}
            helperText={errors?.displayName?.message}
            fullWidth
            autoComplete="off"
          />
          <Input
            {...register('avatarURL')}
            id="Avatar URL"
            label="Avatar URL"
            variant="inline"
            placeholder="Enter Avatar URL"
            hideEmptyHelperText
            error={!!errors.avatarURL}
            helperText={errors?.avatarURL?.message}
            fullWidth
            autoComplete="off"
          />
          <Input
            {...register('email')}
            id="email"
            label="Email"
            variant="inline"
            placeholder="Enter Email"
            hideEmptyHelperText
            error={!!errors.email}
            helperText={
              errors.email ? (
                errors?.email?.message
              ) : (
                <ControlledCheckbox
                  id="emailVerified"
                  name="emailVerified"
                  label="Verified"
                />
              )
            }
            fullWidth
            autoComplete="off"
          />

          <Input
            id="password"
            label="Password"
            variant="inline"
            placeholder="Password is set"
            disabled
            hideEmptyHelperText
            error={!!errors.email}
            fullWidth
            autoComplete="off"
            endAdornment={
              <InputAdornment position="end" className="absolute right-2">
                <IconButton
                  color="primary"
                  variant="borderless"
                  className="px-2"
                  onClick={handleChangeUserPassword}
                >
                  Change
                </IconButton>
              </InputAdornment>
            }
          />
          <Input
            {...register('phoneNumber')}
            id="phoneNumber"
            label="Phone Number"
            variant="inline"
            placeholder="Enter Phone Number"
            error={!!errors.phoneNumber}
            fullWidth
            autoComplete="off"
            helperText={
              errors.phoneNumber ? (
                errors?.phoneNumber?.message
              ) : (
                <ControlledCheckbox
                  id="phoneNumberVerified"
                  name="phoneNumberVerified"
                  label="Verified"
                  disabled={!form.watch('phoneNumber')}
                />
              )
            }
          />
          <ControlledSelect
            {...register('locale')}
            id="locale"
            variant="inline"
            label="Locale"
            slotProps={{ root: { className: 'truncate' } }}
            fullWidth
            error={!!errors.defaultRole}
            helperText={errors?.defaultRole?.message}
          >
            <Option value="en">en</Option>
            <Option value="fr">fr</Option>
          </ControlledSelect>
        </section>

        {/* <section className="grid grid-flow-col grid-cols-8 p-6">
          <div className="col-span-2">
            <InputLabel as="h3">Sign-In Methods</InputLabel>
          </div>
          <div className="grid grid-flow-row col-span-3 gap-y-6">
            <div className="grid grid-flow-col gap-0">
              <Image src="/logos/Apple.svg" width={12} height={15} />
              <Text className="font-medium">Email + Password</Text>
              <Chip component="span" color="info" size="small" label="Active" />
            </div>
            <div className="grid grid-flow-col gap-0">
              <Image src="/logos/Apple.svg" width={12} height={15} />
              <Text className="font-medium">Email + Password</Text>
              <Chip component="span" color="info" size="small" label="Active" />
            </div>
          </div>
        </section> */}

        <section className="grid grid-flow-row p-6 gap-y-10">
          <ControlledSelect
            {...register('defaultRole')}
            id="defaultRole"
            name="defaultRole"
            variant="inline"
            label="Default Role"
            slotProps={{ root: { className: 'truncate' } }}
            hideEmptyHelperText
            fullWidth
            error={!!errors.defaultRole}
            helperText={errors?.defaultRole?.message}
          >
            <Option value="user">user</Option>
            <Option value="me">me</Option>
          </ControlledSelect>
          <div className="grid grid-flow-col grid-cols-8 gap-6 place-content-start">
            <InputLabel as="h3" className="col-span-2">
              Allowed Roles
            </InputLabel>
            <div className="grid grid-flow-row col-span-3 gap-6">
              {allAvailableProjectRoles.map((role) => (
                <ControlledCheckbox
                  key={role.name}
                  name={role.name}
                  value={user.roles[role.name]}
                  label={role.name}
                  defaultChecked={user.roles.some((r) => r.role === role.name)}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="grid justify-between flex-shrink-0 w-full grid-flow-col gap-3 p-2 border-gray-200 place-self-end border-t-1 snap-end">
          <Button
            variant="outlined"
            color="secondary"
            tabIndex={isDirty ? -1 : 0}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button type="submit" className="justify-self-end">
            Save
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
